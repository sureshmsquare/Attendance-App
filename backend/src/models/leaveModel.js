const { pool } = require('../config/database');

/**
 * Fetch all active leave types
 */
const getActiveLeaveTypes = async () => {
  const [rows] = await pool.query(`
    SELECT id, name, code, description, default_days, status, created_at, updated_at
    FROM leave_types
    WHERE status = 'active'
    ORDER BY id ASC
  `);
  return rows;
};

/**
 * Fetch leave type by ID
 */
const getLeaveTypeById = async (id) => {
  const [rows] = await pool.query(`
    SELECT id, name, code, description, default_days, status
    FROM leave_types
    WHERE id = ?
  `, [id]);
  return rows[0] || null;
};

/**
 * Fetch employee leave balances for a specific year
 */
const getEmployeeBalances = async (employeeId, year) => {
  const [rows] = await pool.query(`
    SELECT 
      b.id,
      b.employee_id,
      b.leave_type_id,
      lt.name AS leave_type_name,
      lt.code AS leave_type_code,
      b.total_days,
      b.used_days,
      b.pending_days,
      b.remaining_days,
      b.year,
      b.updated_at
    FROM employee_leave_balances b
    JOIN leave_types lt ON b.leave_type_id = lt.id
    WHERE b.employee_id = ? AND b.year = ?
    ORDER BY lt.id ASC
  `, [employeeId, year]);
  return rows;
};

/**
 * Fetch a specific balance row for an employee and leave type
 */
const getEmployeeBalanceByType = async (employeeId, leaveTypeId, year, connection = pool) => {
  const [rows] = await connection.query(`
    SELECT 
      id, employee_id, leave_type_id, total_days, used_days, pending_days, remaining_days, year
    FROM employee_leave_balances
    WHERE employee_id = ? AND leave_type_id = ? AND year = ?
    FOR UPDATE
  `, [employeeId, leaveTypeId, year]);
  return rows[0] || null;
};

/**
 * Adjust employee leave balance pending/remaining days
 */
const adjustLeaveBalance = async (
  { employeeId, leaveTypeId, year, pendingDelta = 0, remainingDelta = 0, usedDelta = 0 },
  connection = pool
) => {
  const [result] = await connection.query(`
    UPDATE employee_leave_balances
    SET 
      pending_days = pending_days + ?,
      remaining_days = remaining_days + ?,
      used_days = used_days + ?
    WHERE employee_id = ? AND leave_type_id = ? AND year = ?
  `, [pendingDelta, remainingDelta, usedDelta, employeeId, leaveTypeId, year]);
  return result.affectedRows > 0;
};

/**
 * Check if employee has overlapping active (pending or approved) leave requests
 */
const checkOverlappingLeave = async (employeeId, fromDate, toDate, excludeId = null) => {
  let query = `
    SELECT id, from_date, to_date, status, total_days
    FROM leave_requests
    WHERE employee_id = ?
      AND status IN ('pending', 'approved')
      AND from_date <= ?
      AND to_date >= ?
  `;
  const params = [employeeId, toDate, fromDate];

  if (excludeId) {
    query += ' AND id != ?';
    params.push(excludeId);
  }

  const [rows] = await pool.query(query, params);
  return rows;
};

/**
 * Create a new leave request
 */
const createLeaveRequest = async (
  { employeeId, leaveTypeId, fromDate, toDate, totalDays, reason },
  connection = pool
) => {
  const [result] = await connection.query(`
    INSERT INTO leave_requests (
      employee_id, leave_type_id, from_date, to_date, total_days, reason, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')
  `, [employeeId, leaveTypeId, fromDate, toDate, totalDays, reason]);

  const [newRow] = await connection.query(`
    SELECT 
      lr.*,
      lt.name AS leave_type_name,
      lt.code AS leave_type_code
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.id = ?
  `, [result.insertId]);

  return newRow[0];
};

/**
 * Get paginated leave requests for an employee
 */
const getLeaveRequestsByEmployee = async (employeeId, { status = null, year = null, page = 1, limit = 20 }) => {
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10) || 20));
  const offset = (pageNum - 1) * limitNum;

  let whereClauses = ['lr.employee_id = ?'];
  const params = [employeeId];

  if (status) {
    whereClauses.push('lr.status = ?');
    params.push(status);
  }

  if (year) {
    whereClauses.push('YEAR(lr.from_date) = ?');
    params.push(parseInt(year, 10));
  }

  const whereSql = `WHERE ${whereClauses.join(' AND ')}`;

  // Count total records
  const [countResult] = await pool.query(`
    SELECT COUNT(*) AS total
    FROM leave_requests lr
    ${whereSql}
  `, params);

  const total = countResult[0].total;

  // Retrieve records with pagination
  const [records] = await pool.query(`
    SELECT 
      lr.id,
      lr.employee_id,
      lr.leave_type_id,
      lt.name AS leave_type_name,
      lt.code AS leave_type_code,
      lr.from_date,
      lr.to_date,
      lr.total_days,
      lr.reason,
      lr.status,
      lr.applied_at,
      lr.reviewed_at,
      lr.remarks
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    ${whereSql}
    ORDER BY lr.applied_at DESC
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
 * Get leave request by ID for specific employee
 */
const getLeaveRequestById = async (id, employeeId) => {
  const [rows] = await pool.query(`
    SELECT 
      lr.id,
      lr.employee_id,
      lr.leave_type_id,
      lt.name AS leave_type_name,
      lt.code AS leave_type_code,
      lr.from_date,
      lr.to_date,
      lr.total_days,
      lr.reason,
      lr.status,
      lr.applied_at,
      lr.reviewed_at,
      lr.remarks
    FROM leave_requests lr
    JOIN leave_types lt ON lr.leave_type_id = lt.id
    WHERE lr.id = ? AND lr.employee_id = ?
  `, [id, employeeId]);

  return rows[0] || null;
};

/**
 * Cancel a pending leave request
 */
const cancelLeaveRequest = async (id, employeeId, connection = pool) => {
  const [result] = await connection.query(`
    UPDATE leave_requests
    SET status = 'cancelled'
    WHERE id = ? AND employee_id = ? AND status = 'pending'
  `, [id, employeeId]);

  return result.affectedRows > 0;
};

module.exports = {
  getActiveLeaveTypes,
  getLeaveTypeById,
  getEmployeeBalances,
  getEmployeeBalanceByType,
  adjustLeaveBalance,
  checkOverlappingLeave,
  createLeaveRequest,
  getLeaveRequestsByEmployee,
  getLeaveRequestById,
  cancelLeaveRequest
};
