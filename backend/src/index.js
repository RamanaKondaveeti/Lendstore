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
const defaultAdminEmail = process.env.ADMIN_EMAIL || 'admin@hostel.local';
const defaultAdminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';

const corsOrigins = process.env.CORS_ORIGIN?.split(',').map((origin) => origin.trim()) || ['*'];


app.use(helmet({
  crossOriginResourcePolicy: false,
}));
app.use(cors({
  origin: corsOrigins.includes('*') ? true : corsOrigins,
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json());
app.use(morgan('dev'));

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
    mess_plan: row.mess_plan || 'standard'
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
      console.warn('safeAlter warning:', error.message);
    }
  }
}

async function ensureSchema() {
  console.log('Synchronizing database schema...');

  await query(`
    CREATE TABLE IF NOT EXISTS auth_users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(180) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
      room_no VARCHAR(40) NULL,
      upi_id VARCHAR(120) NULL,
      mess_plan VARCHAR(40) NOT NULL DEFAULT 'standard',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  await safeAlter("ALTER TABLE auth_users ADD COLUMN role ENUM('admin', 'user') NOT NULL DEFAULT 'user'");
  await safeAlter('ALTER TABLE auth_users ADD COLUMN room_no VARCHAR(40) NULL');
  await safeAlter('ALTER TABLE auth_users ADD COLUMN upi_id VARCHAR(120) NULL');
  await safeAlter("ALTER TABLE auth_users ADD COLUMN mess_plan VARCHAR(40) NOT NULL DEFAULT 'standard'");

  await query(`
    CREATE TABLE IF NOT EXISTS login_events (
      id INT AUTO_INCREMENT PRIMARY KEY,
      auth_user_id INT NULL,
      email VARCHAR(180) NULL,
      event_type ENUM('register', 'login') NOT NULL,
      success BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

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
      UNIQUE KEY uniq_mess_menu_date (menu_date)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS mess_feedback (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      menu_date DATE NOT NULL,
      rating TINYINT NOT NULL,
      comment TEXT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      UNIQUE KEY uniq_mess_attendance (user_id, attendance_date, meal)
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
      UNIQUE KEY uniq_mess_due (user_id, bill_month)
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS expense_users (
      id INT NOT NULL PRIMARY KEY,
      name VARCHAR(120) NOT NULL,
      email VARCHAR(180) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
      returned_at DATETIME NULL
    )
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS group_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      message TEXT NOT NULL,
      ledger_tag VARCHAR(80) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await seedDemoData();
}

async function seedDemoData() {
  const users = await query('SELECT COUNT(*) AS count FROM auth_users');
  console.log('Checking demo users...');

  const passwordHash = await bcrypt.hash('Hostel@123', 12);
  const ramanaHash = await bcrypt.hash('ramana@123', 12);

  const seededUsers = [
    ['Nivaas Admin', 'admin@hostel.local', passwordHash, 'admin', 'Office', 'hostel@upi', 'management'],
    ['Rahul Sharma', 'rahul@hostel.local', passwordHash, 'user', 'B-204', 'rahul@upi', 'standard'],
    ['Ananya Mehta', 'ananya@hostel.local', passwordHash, 'user', 'B-204', 'ananya@upi', 'standard'],
    ['Kabir Khan', 'kabir@hostel.local', passwordHash, 'user', 'B-205', 'kabir@upi', 'protein'],
    ['Ramana', 'ramana@hostel.local', ramanaHash, 'user', 'C-101', 'ramana@upi', 'standard']
  ];

  for (const row of seededUsers) {
    const existing = await query('SELECT id FROM auth_users WHERE email = :email', { email: row[1] });
    if (existing.length === 0) {
      const res = await query(
        'INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan) VALUES (:name, :email, :hash, :role, :room, :upi, :plan)',
        { name: row[0], email: row[1], hash: row[2], role: row[3], room: row[4], upi: row[5], plan: row[6] }
      );
      await query('INSERT IGNORE INTO expense_users (id, name, email) VALUES (:id, :name, :email)', { id: res.insertId, name: row[0], email: row[1] });
    } else if (row[1] === 'ramana@hostel.local') {
      await query('UPDATE auth_users SET password_hash = :hash WHERE email = :email', { email: row[1], hash: ramanaHash });
    }
  }
}

async function ensureAdminUser() {
  console.log(`Ensuring admin user exists: ${defaultAdminEmail}`);
  const passwordHash = await bcrypt.hash(defaultAdminPassword, 12);

  const rows = await query('SELECT id FROM auth_users WHERE email = :email', { email: defaultAdminEmail });
  if (rows.length) {
    await query(
      "UPDATE auth_users SET password_hash = :hash, role = 'admin' WHERE email = :email",
      { email: defaultAdminEmail, hash: passwordHash }
    );
    console.log('Admin user password and role updated.');
  } else {
    const result = await query(
      `INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan)
       VALUES ('Admin', :email, :hash, 'admin', 'A-1', :email, 'standard')`,
      { email: defaultAdminEmail, hash: passwordHash }
    );
    await query('INSERT IGNORE INTO expense_users (id, name, email) VALUES (:id, :name, :email)', {
      id: result.insertId,
      name: 'Admin',
      email: defaultAdminEmail
    });
    console.log('Admin user created.');
  }
}

// ... Rest of the endpoints (getResidents, getExpenses, getSummary, getAppData, auth routes)
// Note: Keeping the rest of your endpoint logic here but ensuring they are properly bound.

app.get('/health', async (_req, res) => {
  try {
    await query('SELECT 1 AS ok');
    res.json({ ok: true, app: 'HostelLedger', db: 'connected' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  console.log(`Login attempt: ${email}`);

  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const rows = await query('SELECT * FROM auth_users WHERE email = :email', { email });
    const user = rows[0];
    const valid = user ? await bcrypt.compare(password, user.password_hash) : false;

    await query(
      'INSERT INTO login_events (auth_user_id, email, event_type, success) VALUES (:userId, :email, :eventType, :success)',
      { userId: user?.id || null, email, eventType: 'login', success: valid ? 1 : 0 }
    );

    if (!valid) {
      console.log(`Login failed for: ${email}`);
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    console.log(`Login success: ${email} (${user.role})`);
    res.json({ token: signToken(user), user: mapAuthUser(user) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed due to server error' });
  }
});

app.get('/api/app-data', requireAuth, async (req, res) => {
  const rows = await query('SELECT * FROM auth_users WHERE id = :id', { id: req.auth.id });
  if (!rows.length) return res.status(401).json({ message: 'User no longer exists' });
  // Re-using the getAppData logic from your previous file
  const appData = await getAppData(rows[0]);
  res.json(appData);
});

// Helper functions for app-data
async function getResidents() {
  const rows = await query("SELECT id, name, email, role, room_no, upi_id, mess_plan, created_at FROM auth_users WHERE role = 'user' ORDER BY room_no ASC, name ASC");
  return rows.map(mapAuthUser);
}

async function getExpenses() {
  const rows = await query(`SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email FROM expenses e JOIN expense_users u ON u.id = e.paid_by_user_id ORDER BY e.expense_date DESC`);
  const mapped = [];
  for (const row of rows) {
    const participants = await query(`SELECT u.id, u.name, u.email FROM expense_participants ep JOIN expense_users u ON u.id = ep.user_id WHERE ep.expense_id = :id`, { id: row.id });
    mapped.push({
      _id: toClientId(row.id), id: row.id, description: row.description, amount: money(row.amount), date: row.expense_date,
      paidBy: { _id: toClientId(row.paid_by_user_id), name: row.paid_by_name, email: row.paid_by_email },
      participants: participants.map(p => ({ _id: toClientId(p.id), ...p }))
    });
  }
  return mapped;
}

async function getSummary() {
  const users = await query('SELECT * FROM expense_users');
  const expenses = await query('SELECT * FROM expenses');
  const balances = new Map(users.map(u => [u.id, { userId: toClientId(u.id), name: u.name, balance: 0 }]));
  for (const exp of expenses) {
    const parts = await query('SELECT user_id FROM expense_participants WHERE expense_id = :id', { id: exp.id });
    if (!parts.length) continue;
    const share = Number(exp.amount) / parts.length;
    if (balances.has(exp.paid_by_user_id)) balances.get(exp.paid_by_user_id).balance += Number(exp.amount);
    parts.forEach(p => { if (balances.has(p.user_id)) balances.get(p.user_id).balance -= share; });
  }
  return { balances: Array.from(balances.values()).map(b => ({ ...b, balance: money(b.balance) })), settlements: [] };
}

async function getAppData(currentUser) {
  const [residents, menus, feedback, attendance, dues, expenses, summary, borrows, messages] = await Promise.all([
    getResidents(),
    query('SELECT * FROM mess_menus ORDER BY menu_date DESC LIMIT 14'),
    query('SELECT f.*, u.name, u.room_no FROM mess_feedback f JOIN auth_users u ON u.id = f.user_id ORDER BY f.created_at DESC LIMIT 30'),
    query('SELECT a.*, u.name, u.room_no FROM mess_attendance a JOIN auth_users u ON u.id = a.user_id ORDER BY a.attendance_date DESC LIMIT 50'),
    query('SELECT d.*, u.name, u.room_no FROM mess_dues d JOIN auth_users u ON u.id = d.user_id ORDER BY d.bill_month DESC'),
    getExpenses(),
    getSummary(),
    query('SELECT b.*, l.name as lender_name, br.name as borrower_name FROM borrow_items b JOIN auth_users l ON l.id = b.lender_id JOIN auth_users br ON br.id = b.borrower_id'),
    query('SELECT m.*, u.name, u.room_no FROM group_messages m JOIN auth_users u ON u.id = m.user_id ORDER BY m.created_at DESC LIMIT 50')
  ]);

  return {
    residents, menus, feedback, attendance, dues: dues.map(d => ({ ...d, totalAmount: money((d.meals_count * d.rate_per_meal) + d.fixed_charges) })),
    expenses, summary, borrows, messages,
    my: {
      dues: dues.filter(d => d.user_id === currentUser.id),
      borrows: borrows.filter(b => b.lender_id === currentUser.id || b.borrower_id === currentUser.id),
      balance: summary.balances.find(b => b.userId === toClientId(currentUser.id)) || { balance: 0 }
    }
  };
}

// Admin API endpoints
app.post('/api/admin/residents', requireAuth, requireAdmin, async (req, res) => {
  const { name, email, password = 'Hostel@123', roomNo = '', upiId = '', messPlan = 'standard' } = req.body;
  const hash = await bcrypt.hash(password, 12);
  const result = await query('INSERT INTO auth_users (name, email, password_hash, role, room_no, upi_id, mess_plan) VALUES (:name, :email, :hash, "user", :roomNo, :upiId, :messPlan)', { name, email, hash, roomNo, upiId, messPlan });
  await query('INSERT INTO expense_users (id, name, email) VALUES (:id, :name, :email)', { id: result.insertId, name, email });
  res.status(201).json({ id: result.insertId });
});

app.post('/api/admin/menu', requireAuth, requireAdmin, async (req, res) => {
  const { menuDate, breakfast, lunch, dinner, specialNote = '' } = req.body;
  await query('INSERT INTO mess_menus (menu_date, breakfast, lunch, dinner, special_note, created_by) VALUES (:menuDate, :breakfast, :lunch, :dinner, :specialNote, :uid) ON DUPLICATE KEY UPDATE breakfast=VALUES(breakfast), lunch=VALUES(lunch), dinner=VALUES(dinner)', { menuDate, breakfast, lunch, dinner, specialNote, uid: req.auth.id });
  res.status(201).json({ ok: true });
});

app.post('/api/admin/dues', requireAuth, requireAdmin, async (req, res) => {
  const { userId, billMonth, mealsCount, ratePerMeal = 55, fixedCharges = 400, paidAmount = 0, status = 'unpaid' } = req.body;
  await query('INSERT INTO mess_dues (user_id, bill_month, meals_count, rate_per_meal, fixed_charges, paid_amount, status) VALUES (:userId, :billMonth, :mealsCount, :ratePerMeal, :fixedCharges, :paidAmount, :status) ON DUPLICATE KEY UPDATE meals_count=VALUES(meals_count), paid_amount=VALUES(paid_amount), status=VALUES(status)', { userId: parseId(userId), billMonth, mealsCount, ratePerMeal, fixedCharges, paidAmount, status });
  res.status(201).json({ ok: true });
});

app.post('/api/messages', requireAuth, async (req, res) => {
  const { message, ledgerTag = 'chat' } = req.body;
  await query('INSERT INTO group_messages (user_id, message, ledger_tag) VALUES (:uid, :message, :tag)', { uid: req.auth.id, message, tag: ledgerTag });
  res.status(201).json({ ok: true });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Internal Server Error', detail: err.message });
});

ensureSchema()
  .then(() => ensureAdminUser())
  .then(() => {
    app.listen(port, '0.0.0.0', () => {
      console.log(`HostelLedger API listening on ${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
