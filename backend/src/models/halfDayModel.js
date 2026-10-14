const { pool } = require('../config/database');

/**
 * Check if employee has an active (pending or approved) duplicate half-day request
 */
const checkActiveHalfDayDuplicate = async (employeeId, requestDate, session, excludeId = null) => {
  let query = `
    SELECT id, request_date, session, status
    FROM half_day_requests
    WHERE employee_id = ?
      AND request_date = ?
      AND session = ?
      AND status IN ('pending', 'approved')
  `;
  const params = [employeeId, requestDate, session];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const [rows] = await pool.query(query, params);
  return rows[0] || null;
};

/**
 * Create a new half-day request
 */
const createHalfDayRequest = async ({ employeeId, requestDate, session, reason }) => {
  const [result] = await pool.query(`
    INSERT INTO half_day_requests (
      employee_id, request_date, session, reason, status
    ) VALUES (?, ?, ?, ?, 'pending')
  `, [employeeId, requestDate, session, reason]);

  const [rows] = await pool.query(`
    SELECT * FROM half_day_requests WHERE id = ?
  `, [result.insertId]);

  return rows[0];
};

/**
 * Get paginated half-day requests for an employee
 */
const getHalfDayRequestsByEmployee = async (employeeId, { status = null, page = 1, limit = 20 }) => {
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
    FROM half_day_requests
    ${whereSql}
  `, params);

  const total = countResult[0].total;

  const [records] = await pool.query(`
    SELECT 
      id,
      employee_id,
      request_date,
      session,
      reason,
      status,
      applied_at,
      reviewed_at,
      remarks
    FROM half_day_requests
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
 * Get half-day request by ID for employee
 */
const getHalfDayRequestById = async (id, employeeId) => {
  const [rows] = await pool.query(`
    SELECT 
      id,
      employee_id,
      request_date,
      session,
      reason,
      status,
      applied_at,
      reviewed_at,
      remarks
    FROM half_day_requests
    WHERE id = ? AND employee_id = ?
  `, [id, employeeId]);

  return rows[0] || null;
};

/**
 * Cancel a pending half-day request
 */
const cancelHalfDayRequest = async (id, employeeId) => {
  const [result] = await pool.query(`
    UPDATE half_day_requests
    SET status = 'cancelled'
    WHERE id = ? AND employee_id = ? AND status = 'pending'
  `, [id, employeeId]);

  return result.affectedRows > 0;
};

module.exports = {
  checkActiveHalfDayDuplicate,
  createHalfDayRequest,
  getHalfDayRequestsByEmployee,
  getHalfDayRequestById,
  cancelHalfDayRequest
};
