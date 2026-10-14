const { pool } = require('../config/database');

/**
 * Check if employee has overlapping active (pending or approved) permission requests on the same date
 * Overlap condition: (new_from_time < existing_to_time) AND (new_to_time > existing_from_time)
 */
const checkOverlappingPermission = async (employeeId, permissionDate, fromTime, toTime, excludeId = null) => {
  let query = `
    SELECT id, permission_date, from_time, to_time, status, total_minutes
    FROM permission_requests
    WHERE employee_id = ?
      AND permission_date = ?
      AND status IN ('pending', 'approved')
      AND from_time < ?
      AND to_time > ?
  `;
  const params = [employeeId, permissionDate, toTime, fromTime];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Create a new permission request
 */
const createPermissionRequest = async ({ employeeId, permissionDate, fromTime, toTime, totalMinutes, reason }) => {
  const [result] = await pool.query(`
    INSERT INTO permission_requests (
      employee_id, permission_date, from_time, to_time, total_minutes, reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [employeeId, permissionDate, fromTime, toTime, totalMinutes, reason]);

  const [rows] = await pool.query(`
    SELECT * FROM permission_requests WHERE id = ?
  `, [result.insertId]);

  return rows[0];
};

/**
 * Get paginated permission requests for an employee
 */
const getPermissionRequestsByEmployee = async (employeeId, { status = null, page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = ['employee_id = ?'];
  const params = [employeeId];

  if (status) {
    whereClauses.push('status = ?');
    params.push(status);
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  const [countResult] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM permission_requests
    ${whereSql}
  `, params);

  const total = countResult[0].total;

  const [records] = await pool.query(`
    SELECT 
      id,
      employee_id,
      permission_date,
      from_time,
      to_time,
      total_minutes,
      reason,
      status,
      applied_at,
      reviewed_at,
      remarks
    FROM permission_requests
    ${whereSql}
    ORDER BY applied_at DESC
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
 * Get permission request by ID for employee
 */
const getPermissionRequestById = async (id, employeeId) => {
  const [rows] = await pool.query(`
    SELECT 
      id,
      employee_id,
      permission_date,
      from_time,
      to_time,
      total_minutes,
      reason,
      status,
      applied_at,
      reviewed_at,
      remarks
    FROM permission_requests
    WHERE id = ? AND employee_id = ?
  `, [id, employeeId]);

  return rows[0] || null;
};

/**
 * Cancel a pending permission request
 */
const cancelPermissionRequest = async (id, employeeId) => {
  const [result] = await pool.query(`
    UPDATE permission_requests
    SET status = 'cancelled'
    WHERE id = ? AND employee_id = ? AND status = 'pending'
  `, [id, employeeId]);

  return result.affectedRows > 0;
};

module.exports = {
  checkOverlappingPermission,
  createPermissionRequest,
  getPermissionRequestsByEmployee,
  getPermissionRequestById,
  cancelPermissionRequest
};
