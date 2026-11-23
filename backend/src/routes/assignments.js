import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import pool from '../config/db.js';
import { authenticate, authorize } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(authenticate);

router.get('/', asyncHandler(async (req, res) => {
  if (req.user.role === 'admin') {
    const result = await pool.query(`SELECT a.*, u.full_name AS professor_name, (SELECT COUNT(*)::int FROM groups g WHERE NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)) AS target_group_count, (SELECT COUNT(*)::int FROM assignment_submissions s WHERE s.assignment_id = a.id) AS submitted_group_count, COALESCE((SELECT json_agg(ag.group_id) FROM assignment_groups ag WHERE ag.assignment_id = a.id), '[]') AS group_ids FROM assignments a JOIN users u ON u.id = a.created_by ORDER BY a.due_date ASC`);
    return res.json({ assignments: result.rows });
  }
  const result = await pool.query(`SELECT a.id, a.title, a.description, a.due_date, a.onedrive_link, a.created_at, u.full_name AS professor_name, gm.group_id, g.name AS group_name, s.confirmed_at, CASE WHEN s.id IS NULL THEN false ELSE true END AS submitted FROM group_members gm JOIN groups g ON g.id = gm.group_id JOIN assignments a ON (NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = g.id)) JOIN users u ON u.id = a.created_by LEFT JOIN assignment_submissions s ON s.assignment_id = a.id AND s.group_id = g.id WHERE gm.user_id = $1 ORDER BY a.due_date ASC`, [req.user.id]);
  res.json({ assignments: result.rows });
}));

router.get('/:id/progress', authorize('admin'), asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.id);
  const assignment = await pool.query('SELECT id, title FROM assignments WHERE id = $1', [assignmentId]);
  if (!assignment.rowCount) return res.status(404).json({ message: 'Assignment not found' });
  const result = await pool.query(`SELECT g.id AS group_id, g.name AS group_name, s.confirmed_at, confirmer.full_name AS confirmed_by, COALESCE(json_agg(json_build_object('id', u.id, 'fullName', u.full_name, 'email', u.email, 'studentId', u.student_id)) FILTER (WHERE u.id IS NOT NULL), '[]') AS members FROM groups g LEFT JOIN assignment_groups ag ON ag.group_id = g.id AND ag.assignment_id = $1 LEFT JOIN assignment_submissions s ON s.assignment_id = $1 AND s.group_id = g.id LEFT JOIN users confirmer ON confirmer.id = s.confirmed_by LEFT JOIN group_members gm ON gm.group_id = g.id LEFT JOIN users u ON u.id = gm.user_id WHERE NOT EXISTS (SELECT 1 FROM assignment_groups WHERE assignment_id = $1) OR ag.assignment_id = $1 GROUP BY g.id, s.confirmed_at, confirmer.full_name ORDER BY g.name`, [assignmentId]);
  res.json({ assignment: assignment.rows[0], groups: result.rows });
}));

router.post('/', authorize('admin'), asyncHandler(async (req, res) => {
  const { title, description, dueDate, oneDriveLink, groupIds = [] } = req.body;
  if (!String(title || '').trim() || !String(description || '').trim() || !dueDate || !String(oneDriveLink || '').trim()) return res.status(400).json({ message: 'Title, description, due date and OneDrive link are required' });
  if (!Number.isFinite(Date.parse(dueDate))) return res.status(400).json({ message: 'Enter a valid due date' });
  if (!/^https:\/\//i.test(oneDriveLink)) return res.status(400).json({ message: 'OneDrive link must start with https://' });
  if (!Array.isArray(groupIds)) return res.status(400).json({ message: 'Group selection is invalid' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const created = await client.query('INSERT INTO assignments (title, description, due_date, onedrive_link, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *', [String(title).trim(), String(description).trim(), dueDate, oneDriveLink.trim(), req.user.id]);
    const assignment = created.rows[0];
    for (const groupId of [...new Set(groupIds.map(Number))]) {
      if (!Number.isInteger(groupId) || groupId < 1) throw Object.assign(new Error('Invalid group selection'), { status: 400 });
      await client.query('INSERT INTO assignment_groups (assignment_id, group_id) VALUES ($1, $2)', [assignment.id, groupId]);
    }
    await client.query('COMMIT');
    res.status(201).json({ assignment, assignmentScope: groupIds.length ? 'selected_groups' : 'all_groups' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.put('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const { title, description, dueDate, oneDriveLink, groupIds = [] } = req.body;
  if (!String(title || '').trim() || !String(description || '').trim() || !dueDate || !String(oneDriveLink || '').trim() || !Number.isFinite(Date.parse(dueDate))) return res.status(400).json({ message: 'Enter valid assignment details' });
  if (!/^https:\/\//i.test(oneDriveLink)) return res.status(400).json({ message: 'OneDrive link must start with https://' });
  if (!Array.isArray(groupIds)) return res.status(400).json({ message: 'Group selection is invalid' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query('UPDATE assignments SET title = $1, description = $2, due_date = $3, onedrive_link = $4, updated_at = NOW() WHERE id = $5 RETURNING *', [String(title).trim(), String(description).trim(), dueDate, oneDriveLink.trim(), Number(req.params.id)]);
    if (!updated.rowCount) throw Object.assign(new Error('Assignment not found'), { status: 404 });
    await client.query('DELETE FROM assignment_groups WHERE assignment_id = $1', [Number(req.params.id)]);
    for (const groupId of [...new Set(groupIds.map(Number))]) await client.query('INSERT INTO assignment_groups (assignment_id, group_id) VALUES ($1, $2)', [Number(req.params.id), groupId]);
    await client.query('COMMIT');
    res.json({ assignment: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

router.delete('/:id', authorize('admin'), asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM assignments WHERE id = $1 RETURNING id', [Number(req.params.id)]);
  if (!result.rowCount) return res.status(404).json({ message: 'Assignment not found' });
  res.json({ message: 'Assignment deleted' });
}));

router.post('/:id/groups/:groupId/confirmation/start', authorize('student'), asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.id);
  const groupId = Number(req.params.groupId);
  const access = await pool.query(`SELECT a.id FROM assignments a JOIN group_members gm ON gm.group_id = $2 AND gm.user_id = $3 WHERE a.id = $1 AND (NOT EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id) OR EXISTS (SELECT 1 FROM assignment_groups ag WHERE ag.assignment_id = a.id AND ag.group_id = $2))`, [assignmentId, groupId, req.user.id]);
  if (!access.rowCount) return res.status(403).json({ message: 'This assignment is not available to your group' });
  const submitted = await pool.query('SELECT id FROM assignment_submissions WHERE assignment_id = $1 AND group_id = $2', [assignmentId, groupId]);
  if (submitted.rowCount) return res.status(409).json({ message: 'This group has already confirmed submission' });
  const confirmationToken = randomBytes(32).toString('hex');
  await pool.query('INSERT INTO submission_confirmations (assignment_id, group_id, user_id, confirmation_token, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'10 minutes\')', [assignmentId, groupId, req.user.id, confirmationToken]);
  res.json({ confirmationToken, expiresInMinutes: 10, message: 'Review the confirmation and confirm that your group uploaded the work to OneDrive.' });
}));

router.post('/:id/groups/:groupId/confirmation/confirm', authorize('student'), asyncHandler(async (req, res) => {
  const assignmentId = Number(req.params.id);
  const groupId = Number(req.params.groupId);
  const token = String(req.body.confirmationToken || '');
  if (!token) return res.status(400).json({ message: 'Confirmation token is required' });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const confirmation = await client.query(`SELECT sc.id, sc.user_id FROM submission_confirmations sc JOIN group_members gm ON gm.group_id = sc.group_id AND gm.user_id = sc.user_id WHERE sc.confirmation_token = $1 AND sc.assignment_id = $2 AND sc.group_id = $3 AND sc.user_id = $4 AND sc.used_at IS NULL AND sc.expires_at > NOW() FOR UPDATE`, [token, assignmentId, groupId, req.user.id]);
    if (!confirmation.rowCount) throw Object.assign(new Error('Confirmation expired or invalid. Start the confirmation again.'), { status: 400 });
    await client.query('INSERT INTO assignment_submissions (assignment_id, group_id, confirmed_by) VALUES ($1, $2, $3)', [assignmentId, groupId, req.user.id]);
    await client.query('UPDATE submission_confirmations SET used_at = NOW() WHERE id = $1', [confirmation.rows[0].id]);
    await client.query('COMMIT');
    res.status(201).json({ message: 'Submission confirmed successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}));

export default router;
