const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const { pool, query } = require('./db');

const app = express();
const port = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) || ['*'];

app.use(helmet());
app.use(cors({
  origin: corsOrigins.includes('*') ? true : corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(morgan('combined'));

const toClientId = (id) => String(id);
const parseId = (id) => Number(id);
const money = (value) => Number(Number(value || 0).toFixed(2));

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, { expiresIn: '7d' });
}

function mapAuthUser(row) {
  return {
    _id: toClientId(row.id),
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role || 'user',
    roomNo: row.room_no || '',
    upiId: row.upi_id || '',
    messPlan: row.mess_plan || 'standard'
  };
}

function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    req.auth = jwt.verify(token, jwtSecret);
    next();
  } catch (_error) {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.auth?.role !== 'admin') return res.status(403).json({ message: 'Admin access required' });
  next();
}

async function safeAlter(sql) {
  try {
    await query(sql);
  } catch (error) {
    if (!['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_CANT_DROP_FIELD_OR_KEY'].includes(error.code)) {
      throw error;
    }
  }
}

async function ensureSchema() {
  await safeAlter("ALTER TABLE auth_users ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user'");
  await safeAlter('ALTER TABLE auth_users ADD COLUMN room_no VARCHAR(40) NULL');
  await safeAlter('ALTER TABLE auth_users ADD COLUMN upi_id VARCHAR(120) NULL');
  await safeAlter("ALTER TABLE auth_users ADD COLUMN mess_plan VARCHAR(40) NOT NULL DEFAULT 'standard'");

  await query(`
    CREATE TABLE IF NOT EXISTS mess_menus (
      id INT AUTO_INCREMENT PRIMARY KEY,
      menu_date DATE NOT NULL,
      breakfast VARCHAR(255) NOT NULL,
      lunch VARCHAR(255) NOT NULL,
      dinner VARCHAR(255) NOT NULL,
      special_note VARCHAR(255) NULL,
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_mess_menu_date (menu_date),
      CONSTRAINT fk_mess_menus_created_by FOREIGN KEY (created_by) REFERENCES auth_users(id) ON DELETE SET NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mess_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      menu_date DATE NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_mess_feedback_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      CONSTRAINT chk_mess_feedback_rating CHECK (rating BETWEEN 1 AND 5)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mess_attendance (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      attendance_date DATE NOT NULL,
      meal ENUM('breakfast', 'lunch', 'dinner') NOT NULL,
      source ENUM('qr', 'manual') NOT NULL DEFAULT 'manual',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_mess_attendance (user_id, attendance_date, meal),
      CONSTRAINT fk_mess_attendance_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mess_dues (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      bill_month CHAR(7) NOT NULL,
      meals_count INT NOT NULL DEFAULT 0,
      rate_per_meal DECIMAL(10,2) NOT NULL DEFAULT 55.00,
      fixed_charges DECIMAL(10,2) NOT NULL DEFAULT 400.00,
      paid_amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
      status ENUM('unpaid', 'partial', 'paid') NOT NULL DEFAULT 'unpaid',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_mess_due (user_id, bill_month),
      CONSTRAINT fk_mess_dues_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS borrow_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      lender_id INT NOT NULL,
      borrower_id INT NOT NULL,
      item_name VARCHAR(160) NOT NULL,
      notes TEXT NULL,
      status ENUM('borrowed', 'returned') NOT NULL DEFAULT 'borrowed',
      due_date DATE NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      returned_at DATETIME NULL,
      CONSTRAINT fk_borrow_lender FOREIGN KEY (lender_id) REFERENCES auth_users(id) ON DELETE CASCADE,
      CONSTRAINT fk_borrow_borrower FOREIGN KEY (borrower_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      ledger_tag VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT fk_group_messages_user FOREIGN KEY (user_id) REFERENCES auth_users(id) ON DELETE CASCADE
    )
  `);

  await seedDemoData();
}

async function seedDemoData() {
  const users = await query('SELECT COUNT(*) AS count FROM auth_users');
  if (Number(users[0].count) > 0) return;

  const passwordHash = await bcrypt.hash('Hostel@123', 12);
  const seededUsers = [
    ['Nivaas Admin', 'admin@hostel.local', passwordHash, 'admin', 'Office', 'hostel@upi', 'management'],
    ['Rahul Sharma', 'rahul@hostel.local', passwordHash, 'user', 'B-204', 'rahul@upi', 'standard'],
    ['Ananya Mehta', 'ananya@hostel.local', passwordHash, 'user', 'B-204', 'ananya@upi', 'standard'],
    ['Kabir Khan', 'kabir@hostel.local', passwordHash, 'user', 'B-205', 'kabir@upi', 'protein']
  ];

  for (const row of seededUsers) {
    await query(
      'INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan) VALUES (:name, :email, :hash, :role, :room, :upi, :plan)',
      { name: row[0], email: row[1], hash: row[2], role: row[3], room: row[4], upi: row[5], plan: row[6] }
    );
  }

  const expenseUsers = await query("SELECT id, name, email FROM auth_users WHERE role = 'user'");
  for (const user of expenseUsers) {
    await query('INSERT INTO expense_users (id, name, email) VALUES (:id, :name, :email)', user);
  }

  const today = new Date().toISOString().slice(0, 10);
  await query(
    'INSERT INTO mess_menus (menu_date, breakfast, lunch, dinner, special_note, created_by) VALUES (:date, :breakfast, :lunch, :dinner, :note, 1)',
    {
      date: today,
      breakfast: 'Poha, boiled eggs, chai',
      lunch: 'Rajma rice, salad, curd',
      dinner: 'Paneer butter masala, roti, dal tadka',
      note: 'QR attendance closes 20 minutes after each meal starts.'
    }
  );

  await query(
    'INSERT INTO expenses (description, amount, paid_by_user_id, expense_date) VALUES (:description, :amount, 2, NOW())',
    { description: 'Room B-204 groceries', amount: 1260 }
  );
  await query('INSERT INTO expense_participants (expense_id, user_id) VALUES (1, 2), (1, 3)');
  await query("INSERT INTO mess_dues (user_id, bill_month, meals_count, paid_amount, status) VALUES (2, DATE_FORMAT(CURDATE(), '%Y-%m'), 48, 1200, 'partial'), (3, DATE_FORMAT(CURDATE(), '%Y-%m'), 52, 0, 'unpaid'), (4, DATE_FORMAT(CURDATE(), '%Y-%m'), 58, 3590, 'paid')");
  await query("INSERT INTO borrow_items (lender_id, borrower_id, item_name, notes, due_date) VALUES (2, 3, 'Phone charger', 'Type-C fast charger', DATE_ADD(CURDATE(), INTERVAL 2 DAY))");
  await query("INSERT INTO group_messages (user_id, message, ledger_tag) VALUES (2, 'Added groceries for B-204. Please settle before Sunday.', 'expense'), (1, 'Tonight dinner has paneer special. Scan QR at entry.', 'mess')");
}

async function getResidents() {
  const rows = await query("SELECT id, name, email, role, room_no, upi_id, mess_plan, created_at FROM auth_users WHERE role = 'user' ORDER BY room_no ASC, name ASC");
  return rows.map(mapAuthUser);
}

async function getExpenses() {
  const rows = await query(
    `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
     FROM expenses e
     JOIN expense_users u ON u.id = e.paid_by_user_id
     ORDER BY e.expense_date DESC, e.id DESC`
  );

  const mapped = [];
  for (const row of rows) {
    const participants = await query(
      `SELECT u.id, u.name, u.email
       FROM expense_participants ep
       JOIN expense_users u ON u.id = ep.user_id
       WHERE ep.expense_id = :expenseId`,
      { expenseId: row.id }
    );

    mapped.push({
      _id: toClientId(row.id),
      id: row.id,
      description: row.description,
      amount: money(row.amount),
      date: row.expense_date,
      paidBy: { _id: toClientId(row.paid_by_user_id), id: row.paid_by_user_id, name: row.paid_by_name, email: row.paid_by_email },
      participants: participants.map((user) => ({ _id: toClientId(user.id), id: user.id, name: user.name, email: user.email }))
    });
  }
  return mapped;
}

async function getSummary() {
  const [users, expenses] = await Promise.all([
    query('SELECT * FROM expense_users ORDER BY name ASC'),
    query('SELECT * FROM expenses')
  ]);

  const balances = new Map(users.map((user) => [user.id, { userId: toClientId(user.id), name: user.name, balance: 0 }]));

  for (const expense of expenses) {
    const participants = await query('SELECT user_id FROM expense_participants WHERE expense_id = :expenseId', { expenseId: expense.id });
    if (!participants.length) continue;

    const share = Number(expense.amount) / participants.length;
    const payer = balances.get(expense.paid_by_user_id);
    if (payer) payer.balance += Number(expense.amount);

    for (const participant of participants) {
      const balance = balances.get(participant.user_id);
      if (balance) balance.balance -= share;
    }
  }

  const balanceList = [...balances.values()].map((item) => ({ ...item, balance: money(item.balance) }));
  const debtors = balanceList.filter((item) => item.balance < -0.01).map((item) => ({ ...item, amount: Math.abs(item.balance) }));
  const creditors = balanceList.filter((item) => item.balance > 0.01).map((item) => ({ ...item, amount: item.balance }));
  const settlements = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: money(amount) });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i += 1;
    if (creditors[j].amount < 0.01) j += 1;
  }

  return { balances: balanceList, settlements };
}

async function getAppData(currentUser) {
  const [residents, menus, feedback, attendance, dues, expenses, summary, borrows, messages] = await Promise.all([
    getResidents(),
    query('SELECT * FROM mess_menus ORDER BY menu_date DESC LIMIT 14'),
    query(`SELECT f.*, u.name, u.room_no FROM mess_feedback f JOIN auth_users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 30`),
    query(`SELECT a.*, u.name, u.room_no FROM mess_attendance a JOIN auth_users u ON u.id = a.user_id ORDER BY a.attendance_date DESC, a.created_at DESC LIMIT 80`),
    query(`SELECT d.*, u.name, u.room_no FROM mess_dues d JOIN auth_users u ON u.id = d.user_id ORDER BY d.bill_month DESC, u.room_no ASC`),
    getExpenses(),
    getSummary(),
    query(`SELECT b.*, lender.name AS lender_name, borrower.name AS borrower_name
           FROM borrow_items b
           JOIN auth_users lender ON lender.id = b.lender_id
           JOIN auth_users borrower ON borrower.id = b.borrower_id
           ORDER BY b.created_at DESC`),
    query(`SELECT m.*, u.name, u.room_no
           FROM group_messages m
           JOIN auth_users u ON u.id = m.user_id
           ORDER BY m.created_at DESC LIMIT 50`)
  ]);

  const userDues = dues.filter((due) => due.user_id === currentUser.id);
  const userBorrows = borrows.filter((item) => item.lender_id === currentUser.id || item.borrower_id === currentUser.id);
  const userBalance = summary.balances.find((item) => Number(item.userId) === currentUser.id);

  return {
    residents,
    menus: menus.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      menuDate: item.menu_date,
      breakfast: item.breakfast,
      lunch: item.lunch,
      dinner: item.dinner,
      specialNote: item.special_note || ''
    })),
    feedback: feedback.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      userId: item.user_id,
      name: item.name,
      roomNo: item.room_no,
      menuDate: item.menu_date,
      rating: item.rating,
      comment: item.comment || '',
      createdAt: item.created_at
    })),
    attendance: attendance.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      userId: item.user_id,
      name: item.name,
      roomNo: item.room_no,
      attendanceDate: item.attendance_date,
      meal: item.meal,
      source: item.source,
      createdAt: item.created_at
    })),
    dues: dues.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      userId: item.user_id,
      name: item.name,
      roomNo: item.room_no,
      billMonth: item.bill_month,
      mealsCount: item.meals_count,
      ratePerMeal: money(item.rate_per_meal),
      fixedCharges: money(item.fixed_charges),
      paidAmount: money(item.paid_amount),
      totalAmount: money((Number(item.meals_count) * Number(item.rate_per_meal)) + Number(item.fixed_charges)),
      status: item.status
    })),
    expenses,
    summary,
    borrows: borrows.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      lenderId: item.lender_id,
      borrowerId: item.borrower_id,
      lenderName: item.lender_name,
      borrowerName: item.borrower_name,
      itemName: item.item_name,
      notes: item.notes || '',
      status: item.status,
      dueDate: item.due_date,
      createdAt: item.created_at,
      returnedAt: item.returned_at
    })),
    messages: messages.map((item) => ({
      _id: toClientId(item.id),
      id: item.id,
      userId: item.user_id,
      name: item.name,
      roomNo: item.room_no,
      message: item.message,
      ledgerTag: item.ledger_tag || 'chat',
      createdAt: item.created_at
    })),
    my: {
      dues: userDues,
      borrows: userBorrows,
      balance: userBalance || { userId: toClientId(currentUser.id), name: currentUser.name, balance: 0 }
    }
  };
}

app.get('/health', async (_req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ ok: true, app: 'HostelLedger' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password, roomNo = '', upiId = '', messPlan = 'standard' } = req.body;
  if (!name || !email || !password) return res.status(400).json({ message: 'Name, email, and password are required' });

  const existing = await query('SELECT id FROM auth_users WHERE email = :email', { email });
  if (existing.length) return res.status(409).json({ message: 'Email is already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    "INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan) VALUES (:name, :email, :passwordHash, 'user', :roomNo, :upiId, :messPlan)",
    { name, email, passwordHash, roomNo, upiId, messPlan }
  );
  await query('INSERT INTO expense_users (id, name, email) VALUES (:id, :name, :email)', { id: result.insertId, name, email });
  await query('INSERT INTO login_events (auth_user_id, event_type) VALUES (:userId, :eventType)', { userId: result.insertId, eventType: 'register' });

  const user = { id: result.insertId, name, email, role: 'user', room_no: roomNo, upi_id: upiId, mess_plan: messPlan };
  res.status(201).json({ token: signToken(user), user: mapAuthUser(user) });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  const rows = await query('SELECT * FROM auth_users WHERE email = :email', { email });
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

  await query(
    'INSERT INTO login_events (auth_user_id, email, event_type, success) VALUES (:userId, :email, :eventType, :success)',
    { userId: user?.id || null, email, eventType: 'login', success: valid ? 1 : 0 }
  );

  if (!valid) return res.status(401).json({ message: 'Invalid email or password' });
  res.json({ token: signToken(user), user: mapAuthUser(user) });
});

app.get('/api/app-data', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM auth_users WHERE id = :id', { id: req.auth.id });
  if (!rows.length) return res.status(401).json({ message: 'User no longer exists' });
  res.json(await getAppData(rows[0]));
});

app.post('/api/admin/residents', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password = 'Hostel@123', roomNo = '', upiId = '', messPlan = 'standard' } = req.body;
  if (!name || !email) return res.status(400).json({ message: 'Name and email are required' });

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    "INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan) VALUES (:name, :email, :passwordHash, 'user', :roomNo, :upiId, :messPlan)",
    { name, email, passwordHash, roomNo, upiId, messPlan }
  );
  await query('INSERT INTO expense_users (id, name, email) VALUES (:id, :name, :email)', { id: result.insertId, name, email });
  res.status(201).json({ id: result.insertId });
});

app.post('/api/admin/menu', requireAuth, requireAdmin, async (req, res) => {
  const { menuDate, breakfast, lunch, dinner, specialNote = '' } = req.body;
  if (!menuDate || !breakfast || !lunch || !dinner) return res.status(400).json({ message: 'Date and all meals are required' });

  await query(
    `INSERT INTO mess_menus (menu_date, breakfast, lunch, dinner, special_note, created_by)
     VALUES (:menuDate, :breakfast, :lunch, :dinner, :specialNote, :userId)
     ON DUPLICATE KEY UPDATE breakfast = VALUES(breakfast), lunch = VALUES(lunch), dinner = VALUES(dinner), special_note = VALUES(special_note)`,
    { menuDate, breakfast, lunch, dinner, specialNote, userId: req.auth.id }
  );
  res.status(201).json({ ok: true });
});

app.post('/api/admin/dues', requireAuth, requireAdmin, async (req, res) => {
  const { userId, billMonth, mealsCount, ratePerMeal = 55, fixedCharges = 400, paidAmount = 0, status = 'unpaid' } = req.body;
  if (!userId || !billMonth) return res.status(400).json({ message: 'Resident and month are required' });

  await query(
    `INSERT INTO mess_dues (user_id, bill_month, meals_count, rate_per_meal, fixed_charges, paid_amount, status)
     VALUES (:userId, :billMonth, :mealsCount, :ratePerMeal, :fixedCharges, :paidAmount, :status)
     ON DUPLICATE KEY UPDATE meals_count = VALUES(meals_count), rate_per_meal = VALUES(rate_per_meal),
       fixed_charges = VALUES(fixed_charges), paid_amount = VALUES(paid_amount), status = VALUES(status)`,
    { userId: parseId(userId), billMonth, mealsCount: Number(mealsCount || 0), ratePerMeal, fixedCharges, paidAmount, status }
  );
  res.status(201).json({ ok: true });
});

app.post('/api/attendance', requireAuth, async (req, res) => {
  const { meal, attendanceDate = new Date().toISOString().slice(0, 10), source = 'qr' } = req.body;
  if (!['breakfast', 'lunch', 'dinner'].includes(meal)) return res.status(400).json({ message: 'Valid meal is required' });

  await query(
    `INSERT INTO mess_attendance (user_id, attendance_date, meal, source)
     VALUES (:userId, :attendanceDate, :meal, :source)
     ON DUPLICATE KEY UPDATE source = VALUES(source)`,
    { userId: req.auth.id, attendanceDate, meal, source }
  );
  res.status(201).json({ ok: true });
});

app.post('/api/feedback', requireAuth, async (req, res) => {
  const { menuDate = new Date().toISOString().slice(0, 10), rating, comment = '' } = req.body;
  if (!rating) return res.status(400).json({ message: 'Rating is required' });

  await query(
    'INSERT INTO mess_feedback (user_id, menu_date, rating, comment) VALUES (:userId, :menuDate, :rating, :comment)',
    { userId: req.auth.id, menuDate, rating: Number(rating), comment }
  );
  res.status(201).json({ ok: true });
});

app.get('/api/users', requireAuth, async (_req, res) => {
  res.json(await getResidents());
});

app.post('/api/expenses', requireAuth, async (req, res) => {
  const { description, amount, paidBy, participants = [], date } = req.body;
  if (!description || !amount || !paidBy || !participants.length) {
    return res.status(400).json({ message: 'Description, amount, payer, and participants are required' });
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [result] = await conn.execute(
      'INSERT INTO expenses (description, amount, paid_by_user_id, expense_date) VALUES (?, ?, ?, ?)',
      [description, Number(amount), parseId(paidBy), date ? new Date(date) : new Date()]
    );
    for (const participantId of participants) {
      await conn.execute('INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)', [result.insertId, parseId(participantId)]);
    }
    await conn.execute('INSERT INTO group_messages (user_id, message, ledger_tag) VALUES (?, ?, ?)', [req.auth.id, `Added split: ${description} for Rs. ${Number(amount).toFixed(2)}`, 'expense']);
    await conn.commit();
    res.status(201).json({ _id: toClientId(result.insertId), id: result.insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

app.post('/api/borrow', requireAuth, async (req, res) => {
  const { lenderId, borrowerId, itemName, notes = '', dueDate = null } = req.body;
  if (!lenderId || !borrowerId || !itemName) return res.status(400).json({ message: 'Lender, borrower, and item are required' });

  const result = await query(
    'INSERT INTO borrow_items (lender_id, borrower_id, item_name, notes, due_date) VALUES (:lenderId, :borrowerId, :itemName, :notes, :dueDate)',
    { lenderId: parseId(lenderId), borrowerId: parseId(borrowerId), itemName, notes, dueDate }
  );
  await query('INSERT INTO group_messages (user_id, message, ledger_tag) VALUES (:userId, :message, :tag)', {
    userId: req.auth.id,
    message: `Logged borrow item: ${itemName}`,
    tag: 'borrow'
  });
  res.status(201).json({ id: result.insertId });
});

app.patch('/api/borrow/:id/return', requireAuth, async (req, res) => {
  await query("UPDATE borrow_items SET status = 'returned', returned_at = NOW() WHERE id = :id", { id: parseId(req.params.id) });
  res.json({ ok: true });
});

app.post('/api/messages', requireAuth, async (req, res) => {
  const { message, ledgerTag = 'chat' } = req.body;
  if (!message) return res.status(400).json({ message: 'Message is required' });
  const result = await query('INSERT INTO group_messages (user_id, message, ledger_tag) VALUES (:userId, :message, :ledgerTag)', {
    userId: req.auth.id,
    message,
    ledgerTag
  });
  res.status(201).json({ id: result.insertId });
});

app.post('/api/reminders/upi', requireAuth, async (req, res) => {
  const { toUserId, amount, note = 'Hostel split reminder' } = req.body;
  if (!toUserId || !amount) return res.status(400).json({ message: 'Recipient and amount are required' });
  const rows = await query('SELECT name, upi_id FROM auth_users WHERE id = :id', { id: parseId(toUserId) });
  if (!rows.length) return res.status(404).json({ message: 'Recipient not found' });
  res.json({
    ok: true,
    message: `Reminder queued for ${rows[0].name}`,
    upiIntent: `upi://pay?pa=${encodeURIComponent(rows[0].upi_id || '')}&am=${encodeURIComponent(amount)}&tn=${encodeURIComponent(note)}`
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
});

ensureSchema()
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`HostelLedger API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to prepare database schema', error);
    process.exit(1);
  });
