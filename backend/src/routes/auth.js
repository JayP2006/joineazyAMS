import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import pool from '../config/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const registerSchema = z.object({ fullName: z.string().trim().min(2).max(120), email: z.string().email().max(180), studentId: z.string().trim().max(60).optional().or(z.literal('')), password: z.string().min(8).max(100), role: z.enum(['student', 'admin']).default('student'), adminCode: z.string().optional() });
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role, fullName: user.full_name }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

router.post('/register', asyncHandler(async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0].message });
  const { fullName, email, studentId, password, role, adminCode } = parsed.data;
  if (role === 'admin' && (!adminCode || adminCode !== process.env.ADMIN_REGISTRATION_CODE)) return res.status(403).json({ message: 'A valid professor registration code is required' });
  if (role === 'student' && !studentId) return res.status(400).json({ message: 'Student ID is required' });
  const passwordHash = await bcrypt.hash(password, 12);
  const result = await pool.query('INSERT INTO users (full_name, email, student_id, password_hash, role) VALUES ($1, $2, $3, $4, $5) RETURNING id, full_name, email, student_id, role', [fullName, email.toLowerCase(), studentId || null, passwordHash, role]);
  const user = result.rows[0];
  res.status(201).json({ token: createToken(user), user });
}));

router.post('/login', asyncHandler(async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: 'Enter a valid email and password' });
  const { email, password } = parsed.data;
  const result = await pool.query('SELECT id, full_name, email, student_id, password_hash, role FROM users WHERE email = $1', [email.toLowerCase()]);
  const user = result.rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
  delete user.password_hash;
  res.json({ token: createToken(user), user });
}));

router.get('/me', authenticate, asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT id, full_name, email, student_id, role, created_at FROM users WHERE id = $1', [req.user.id]);
  if (!result.rowCount) return res.status(404).json({ message: 'User not found' });
  res.json({ user: result.rows[0] });
}));

export default router;
