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

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') || true, credentials: true }));
app.use(express.json());
app.use(morgan('combined'));

const toClientId = (id) => String(id);
const parseId = (id) => Number(id);

function signToken(user) {
  return jwt.sign({ id: user.id, email: user.email }, jwtSecret, { expiresIn: '7d' });
}

function mapAuthUser(row) {
  return { _id: toClientId(row.id), id: row.id, name: row.name, email: row.email };
}

function mapExpenseUser(row) {
  return { _id: toClientId(row.id), id: row.id, name: row.name, email: row.email };
}

function mapBill(row) {
  return {
    _id: toClientId(row.id),
    id: row.id,
    name: row.name,
    amount: Number(row.amount),
    dueDay: row.due_day,
    notifyEmail: row.notify_email,
    notes: row.notes || '',
    createdAt: row.created_at
  };
}

async function mapExpense(row) {
  const participants = await query(
    `SELECT u.id, u.name, u.email
     FROM expense_participants ep
     JOIN expense_users u ON u.id = ep.user_id
     WHERE ep.expense_id = :expenseId`,
    { expenseId: row.id }
  );

  return {
    _id: toClientId(row.id),
    id: row.id,
    description: row.description,
    amount: Number(row.amount),
    date: row.expense_date,
    paidBy: {
      _id: toClientId(row.paid_by_id),
      id: row.paid_by_id,
      name: row.paid_by_name,
      email: row.paid_by_email
    },
    participants: participants.map(mapExpenseUser)
  };
}

app.get('/health', async (_req, res) => {
  await query('SELECT 1 AS ok');
  res.json({ ok: true });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email, and password are required' });
  }

  const existing = await query('SELECT id FROM auth_users WHERE email = :email', { email });
  if (existing.length) return res.status(409).json({ message: 'Email is already registered' });

  const passwordHash = await bcrypt.hash(password, 12);
  const result = await query(
    'INSERT INTO auth_users (name, email, password_hash) VALUES (:name, :email, :passwordHash)',
    { name, email, passwordHash }
  );

  await query('INSERT INTO expense_users (name, email) VALUES (:name, :email)', { name, email });
  await query(
    'INSERT INTO login_events (auth_user_id, event_type) VALUES (:userId, :eventType)',
    { userId: result.insertId, eventType: 'register' }
  );

  const user = { id: result.insertId, name, email };
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

app.get('/api/users', async (_req, res) => {
  const rows = await query('SELECT * FROM expense_users ORDER BY name ASC');
  res.json(rows.map(mapExpenseUser));
});

app.post('/api/users', async (req, res) => {
  const { name, email = null } = req.body;
  if (!name) return res.status(400).json({ message: 'Name is required' });

  const result = await query('INSERT INTO expense_users (name, email) VALUES (:name, :email)', { name, email });
  res.status(201).json({ _id: toClientId(result.insertId), id: result.insertId, name, email });
});

app.delete('/api/users/:id', async (req, res) => {
  const id = parseId(req.params.id);
  const used = await query(
    `SELECT
      (SELECT COUNT(*) FROM expenses WHERE paid_by_user_id = :id) +
      (SELECT COUNT(*) FROM expense_participants WHERE user_id = :id) AS count`,
    { id }
  );

  if (Number(used[0].count) > 0) {
    return res.status(409).json({ message: 'User is linked to expenses and cannot be deleted' });
  }

  await query('DELETE FROM expense_users WHERE id = :id', { id });
  res.json({ ok: true });
});

app.get('/api/expenses', async (_req, res) => {
  const rows = await query(
    `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
     FROM expenses e
     JOIN expense_users u ON u.id = e.paid_by_user_id
     ORDER BY e.expense_date DESC, e.id DESC`
  );
  res.json(await Promise.all(rows.map(mapExpense)));
});

app.post('/api/expenses', async (req, res) => {
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
      await conn.execute(
        'INSERT INTO expense_participants (expense_id, user_id) VALUES (?, ?)',
        [result.insertId, parseId(participantId)]
      );
    }

    await conn.commit();
    res.status(201).json({ _id: toClientId(result.insertId), id: result.insertId });
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
});

app.delete('/api/expenses/:id', async (req, res) => {
  await query('DELETE FROM expenses WHERE id = :id', { id: parseId(req.params.id) });
  res.json({ ok: true });
});

app.get('/api/bills', async (_req, res) => {
  const rows = await query('SELECT * FROM bills ORDER BY due_day ASC, name ASC');
  res.json(rows.map(mapBill));
});

app.post('/api/bills', async (req, res) => {
  const { name, amount, dueDay, notifyEmail, notes = '' } = req.body;
  if (!name || !amount || !dueDay || !notifyEmail) {
    return res.status(400).json({ message: 'Name, amount, due day, and notification email are required' });
  }

  const result = await query(
    'INSERT INTO bills (name, amount, due_day, notify_email, notes) VALUES (:name, :amount, :dueDay, :notifyEmail, :notes)',
    { name, amount: Number(amount), dueDay: Number(dueDay), notifyEmail, notes }
  );
  res.status(201).json({ _id: toClientId(result.insertId), id: result.insertId });
});

app.delete('/api/bills/:id', async (req, res) => {
  await query('DELETE FROM bills WHERE id = :id', { id: parseId(req.params.id) });
  res.json({ ok: true });
});

app.post('/api/reminders/run', async (_req, res) => {
  const today = new Date().getDate();
  const rows = await query('SELECT * FROM bills WHERE due_day = :today ORDER BY name ASC', { today });
  res.json({ sent: rows.map(mapBill) });
});

app.get('/api/summary', async (_req, res) => {
  const [users, expenses] = await Promise.all([
    query('SELECT * FROM expense_users ORDER BY name ASC'),
    query(
      `SELECT e.*, u.name AS paid_by_name, u.email AS paid_by_email
       FROM expenses e
       JOIN expense_users u ON u.id = e.paid_by_user_id`
    )
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

  const balanceList = [...balances.values()].map((item) => ({
    ...item,
    balance: Number(item.balance.toFixed(2))
  }));

  const debtors = balanceList.filter((b) => b.balance < -0.01).map((b) => ({ ...b, amount: Math.abs(b.balance) }));
  const creditors = balanceList.filter((b) => b.balance > 0.01).map((b) => ({ ...b, amount: b.balance }));
  const settlements = [];

  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount);
    settlements.push({ from: debtors[i].name, to: creditors[j].name, amount: Number(amount.toFixed(2)) });
    debtors[i].amount -= amount;
    creditors[j].amount -= amount;
    if (debtors[i].amount < 0.01) i += 1;
    if (creditors[j].amount < 0.01) j += 1;
  }

  res.json({ balances: balanceList, settlements });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ message: 'Server error', detail: process.env.NODE_ENV === 'production' ? undefined : err.message });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`LendStore API listening on ${port}`);
});
