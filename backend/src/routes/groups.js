import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  const values = [];
  let filter = '';
  if (req.user.role === 'student') {
    values.push(req.user.id);
    filter = 'WHERE EXISTS (SELECT 1 FROM group_members mine WHERE mine.group_id = g.id AND mine.user_id = $1)';
  }
  const result = await pool.query(`SELECT g.id, g.name, g.description, g.created_by, g.created_at, creator.full_name AS created_by_name, COUNT(gm.user_id)::int AS member_count, COALESCE(json_agg(json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'studentId', u.student_id)) FILTER (WHERE u.id IS NOT NULL), '[]') AS members FROM groups g JOIN users creator ON creator.id = g.created_by LEFT JOIN group_members gm ON gm.group_id = g.id LEFT JOIN users u ON u.id = gm.user_id ${filter} GROUP BY g.id, creator.full_name ORDER BY g.created_at DESC`, values);
  res.json({ groups: result.rows });
}));

router.post('/', authorize('student'), asyncHandler(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const description = String(req.body.description || '').trim();
  if (name.length < 2 || name.length > 120) return res.status(400).json({ message: 'Group name must be between 2 and 120 characters' });
  const existing = await pool.query('SELECT group_id FROM group_members WHERE user_id = $1', [req.user.id]);
  if (existing.rowCount) return res.status(409).json({ message: 'You are already part of a group. Leave your current group before creating another one.' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const group = await client.query('INSERT INTO groups (name, description, created_by) VALUES ($1, $2, $3) RETURNING *', [name, description, req.user.id]);
    await client.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [group.rows[0].id, req.user.id]);
    await client.query('COMMIT');
    res.status(201).json({ group: group.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.post('/:groupId/members', authorize('student'), asyncHandler(async (req, res) => {
  const groupId = Number(req.params.groupId);
  const identifier = String(req.body.identifier || '').trim();
  if (!Number.isInteger(groupId) || !identifier) return res.status(400).json({ message: 'Enter a valid student email or ID' });
  const membership = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);
  if (!membership.rowCount) return res.status(403).json({ message: 'Only current group members can add students' });
  const target = await pool.query('SELECT id, full_name, email, student_id FROM users WHERE (LOWER(email) = LOWER($1) OR student_id = $1) AND role = \'student\'', [identifier]);
  if (!target.rowCount) return res.status(404).json({ message: 'No student found with that email or ID' });
  if (Number(target.rows[0].id) === Number(req.user.id)) return res.status(400).json({ message: 'You are already in this group' });
  const already = await pool.query('SELECT group_id FROM group_members WHERE user_id = $1', [target.rows[0].id]);
  if (already.rowCount) return res.status(409).json({ message: 'This student is already a member of a group' });
  await pool.query('INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)', [groupId, target.rows[0].id]);
  res.status(201).json({ message: `${target.rows[0].full_name} added to the group`, member: target.rows[0] });
}));

router.delete('/:groupId/members/:userId', authorize('student'), asyncHandler(async (req, res) => {
  const groupId = Number(req.params.groupId);
  const userId = Number(req.params.userId);
  const membership = await pool.query('SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2', [groupId, req.user.id]);
  if (!membership.rowCount) return res.status(403).json({ message: 'You are not a member of this group' });
  if (userId === Number(req.user.id)) return res.status(400).json({ message: 'Group members cannot remove themselves using this action' });
  const result = await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING user_id', [groupId, userId]);
  if (!result.rowCount) return res.status(404).json({ message: 'Member not found in this group' });
  res.json({ message: 'Member removed' });
}));

router.delete('/:groupId/leave', authorize('student'), asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING group_id', [Number(req.params.groupId), req.user.id]);
  if (!result.rowCount) return res.status(404).json({ message: 'Group membership not found' });
  const remaining = await pool.query('SELECT COUNT(*)::int AS count FROM group_members WHERE group_id = $1', [Number(req.params.groupId)]);
  if (remaining.rows[0].count === 0) await pool.query('DELETE FROM groups WHERE id = $1', [Number(req.params.groupId)]);
  res.json({ message: 'You have left the group' });
}));

export default router;
