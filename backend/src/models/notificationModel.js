const { pool } = require('../config/database');

/**
 * Create a new notification record for an employee
 */
const createNotification = async ({
  employeeId,
  title,
  message,
  type = 'system',
  referenceId = null
}) => {
  const [result] = await pool.query(`
    INSERT INTO notifications (
      employee_id, title, message, type, reference_id, is_read
    ) VALUES (?, ?, ?, ?, ?, FALSE)
  `, [employeeId, title, message, type, referenceId ? String(referenceId) : null]);

  const [rows] = await pool.query(`
    SELECT * FROM notifications WHERE id = ?
  `, [result.insertId]);

  return rows[0];
};

/**
 * Get paginated notifications for an employee
 */
const getNotificationsByEmployee = async (employeeId, { isRead = null, page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = ['employee_id = ?'];
  const params = [employeeId];

  if (isRead !== null && isRead !== undefined) {
    whereClauses.push('is_read = ?');
    params.push(isRead ? 1 : 0);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const [countResult] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM notifications
    ${whereSql}
  `, params);

  const total = countResult[0].total;

  const [records] = await pool.query(`
    SELECT 
      id,
      employee_id,
      title,
      message,
      type,
      reference_id,
      is_read,
      created_at,
      updated_at
    FROM notifications
    ${whereSql}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `, [...params, limitNum, offset]);

  return {
    records,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1
    }
  };
};

/**
 * Get total unread count for an employee
 */
const getUnreadCount = async (employeeId) => {
  const [rows] = await pool.query(`
    SELECT COUNT(*) AS unread_count
    FROM notifications
    WHERE employee_id = ? AND is_read = FALSE
  `, [employeeId]);

  return rows[0]?.unread_count || 0;
};

/**
 * Get notification by ID and ensure ownership
 */
const getNotificationById = async (id, employeeId) => {
  const [rows] = await pool.query(`
    SELECT * FROM notifications
    WHERE id = ? AND employee_id = ?
  `, [id, employeeId]);

  return rows[0] || null;
};

/**
 * Mark a single notification as read
 */
const markAsRead = async (id, employeeId) => {
  const [result] = await pool.query(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE id = ? AND employee_id = ?
  `, [id, employeeId]);

  return result.affectedRows > 0;
};

/**
 * Mark all notifications as read for an employee
 */
const markAllAsRead = async (employeeId) => {
  const [result] = await pool.query(`
    UPDATE notifications
    SET is_read = TRUE
    WHERE employee_id = ? AND is_read = FALSE
  `, [employeeId]);

  return result.affectedRows;
};

module.exports = {
  createNotification,
  getNotificationsByEmployee,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead
};
