import { Router } from 'express';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate, authorize('admin'));

router.get('/analytics', asyncHandler(async (req, res) => {
  const [counts, assignmentStats, groupStats, studentStats] = await Promise.all([
    pool.query(`SELECT (SELECT COUNT(*)::int FROM users WHERE role = 'student') AS students, (SELECT COUNT(*)::int FROM groups) AS groups, (SELECT COUNT(*)::int FROM assignments) AS assignments, (SELECT COUNT(*)::int FROM assignment_submissions) AS submissions`),
    pool.query(`SELECT a.id, a.title, COUNT(DISTINCT g.id)::int AS total_groups, COUNT(DISTINCT s.group_id)::int AS submitted_groups FROM assignments a LEFT JOIN groups g ON (NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)) LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.group_id = g.id GROUP BY a.id ORDER BY a.due_date ASC`),
    pool.query(`SELECT g.id, g.name, COUNT(DISTINCT gm.user_id)::int AS member_count, COUNT(DISTINCT a.id)::int AS assignment_count, COUNT(DISTINCT s.assignment_id)::int AS submitted_count FROM groups g LEFT JOIN group_members gm ON gm.group_id = g.id LEFT JOIN assignments a ON g.id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)) LEFT JOIN assignment_submissions s ON s.group_id = g.id AND s.assignment_id = a.id GROUP BY g.id ORDER BY g.name`),
    pool.query(`SELECT u.id, u.full_name, u.email, u.student_id, g.name AS group_name, COUNT(DISTINCT a.id)::int AS assigned_count, COUNT(DISTINCT s.assignment_id)::int AS submitted_count FROM users u LEFT JOIN group_members gm ON gm.user_id = u.id LEFT JOIN groups g ON g.id = gm.group_id LEFT JOIN assignments a ON g.id IS NOT NULL AND (NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)) LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.group_id = g.id WHERE u.role = 'student' GROUP BY u.id, g.name ORDER BY u.full_name`)
  ]);
  res.json({ summary: counts.rows[0], assignments: assignmentStats.rows, groups: groupStats.rows, students: studentStats.rows });
}));

router.get('/students', asyncHandler(async (req, res) => {
  const result = await pool.query(`SELECT u.id, u.full_name, u.email, u.student_id, u.created_at, g.id AS group_id, g.name AS group_name FROM users u LEFT JOIN group_members gm ON gm.user_id = u.id LEFT JOIN groups g ON g.id = gm.group_id WHERE u.role = 'student' ORDER BY u.full_name`);
  res.json({ students: result.rows });
}));

export default router;
