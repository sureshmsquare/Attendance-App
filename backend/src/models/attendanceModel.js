const { pool } = require('../config/database');

/**
 * Find attendance by primary ID
 * @param {number} id
 */
const findById = async (id) => {
  const query = `
    SELECT id, employee_id, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date, 
           TIME_FORMAT(check_in_time, '%H:%i:%s') AS check_in_time,
           TIME_FORMAT(check_out_time, '%H:%i:%s') AS check_out_time,
           check_in_latitude, check_in_longitude, check_in_accuracy,
           check_out_latitude, check_out_longitude, check_out_accuracy,
           working_minutes, status, created_at, updated_at
    FROM attendance
    WHERE id = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [id]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Find attendance record for an employee on a specific date
 * @param {number} employeeId
 * @param {string} attendanceDate YYYY-MM-DD
 */
const findByEmployeeAndDate = async (employeeId, attendanceDate) => {
  const query = `
    SELECT id, employee_id, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date, 
           TIME_FORMAT(check_in_time, '%H:%i:%s') AS check_in_time,
           TIME_FORMAT(check_out_time, '%H:%i:%s') AS check_out_time,
           check_in_latitude, check_in_longitude, check_in_accuracy,
           check_out_latitude, check_out_longitude, check_out_accuracy,
           working_minutes, status, created_at, updated_at
    FROM attendance
    WHERE employee_id = ? AND attendance_date = ?
    LIMIT 1
  `;
  const [rows] = await pool.query(query, [employeeId, attendanceDate]);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Record employee check-in
 */
const createCheckIn = async ({
  employee_id,
  attendance_date,
  check_in_time,
  check_in_latitude,
  check_in_longitude,
  check_in_accuracy = null
}) => {
  const query = `
    INSERT INTO attendance (
      employee_id, attendance_date, check_in_time,
      check_in_latitude, check_in_longitude, check_in_accuracy,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, 'present')
  `;
  const [result] = await pool.query(query, [
    employee_id,
    attendance_date,
    check_in_time,
    check_in_latitude,
    check_in_longitude,
    check_in_accuracy !== undefined && check_in_accuracy !== null
      ? parseFloat(check_in_accuracy)
      : null
  ]);

  return findById(result.insertId);
};

/**
 * Record employee check-out
 */
const updateCheckOut = async (
  attendanceId,
  {
    check_out_time,
    check_out_latitude,
    check_out_longitude,
    check_out_accuracy = null,
    working_minutes = 0
  }
) => {
  const query = `
    UPDATE attendance
    SET check_out_time = ?,
        check_out_latitude = ?,
        check_out_longitude = ?,
        check_out_accuracy = ?,
        working_minutes = ?,
        status = 'completed'
    WHERE id = ?
  `;
  await pool.query(query, [
    check_out_time,
    check_out_latitude,
    check_out_longitude,
    check_out_accuracy !== undefined && check_out_accuracy !== null
      ? parseFloat(check_out_accuracy)
      : null,
    working_minutes,
    attendanceId
  ]);

  return findById(attendanceId);
};

/**
 * Fetch employee attendance history with optional filters and pagination
 */
const getHistory = async (employeeId, { fromDate, toDate, status, page = 1, limit = 20 }) => {
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const offset = (safePage - 1) * safeLimit;

  const conditions = ['employee_id = ?'];
  const params = [employeeId];

  if (fromDate) {
    conditions.push('attendance_date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('attendance_date <= ?');
    params.push(toDate);
  }
  if (status) {
    conditions.push('status = ?');
    params.push(status);
  }

  const whereClause = conditions.join(' AND ');

  // 1. Count total matching records
  const countQuery = `SELECT COUNT(*) AS total FROM attendance WHERE ${whereClause}`;
  const [countRows] = await pool.query(countQuery, params);
  const total = countRows[0].total || 0;
  const totalPages = Math.ceil(total / safeLimit);

  // 2. Fetch records
  const dataQuery = `
    SELECT id, employee_id, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
           TIME_FORMAT(check_in_time, '%H:%i:%s') AS check_in_time,
           TIME_FORMAT(check_out_time, '%H:%i:%s') AS check_out_time,
           check_in_latitude, check_in_longitude, check_in_accuracy,
           check_out_latitude, check_out_longitude, check_out_accuracy,
           working_minutes, status, created_at, updated_at
    FROM attendance
    WHERE ${whereClause}
    ORDER BY attendance_date DESC, id DESC
    LIMIT ? OFFSET ?
  `;
  const [records] = await pool.query(dataQuery, [...params, safeLimit, offset]);

  return {
    records,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages
    }
  };
};

/**
 * Fetch all attendance records for an employee in a given month
 */
const getMonthlyRecords = async (employeeId, year, month) => {
  const padMonth = String(month).padStart(2, '0');
  const startDate = `${year}-${padMonth}-01`;

  // Calculate last day of the month
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${year}-${padMonth}-${String(lastDay).padStart(2, '0')}`;

  const query = `
    SELECT id, employee_id, DATE_FORMAT(attendance_date, '%Y-%m-%d') AS attendance_date,
           TIME_FORMAT(check_in_time, '%H:%i:%s') AS check_in_time,
           TIME_FORMAT(check_out_time, '%H:%i:%s') AS check_out_time,
           check_in_latitude, check_in_longitude, check_in_accuracy,
           check_out_latitude, check_out_longitude, check_out_accuracy,
           working_minutes, status, created_at, updated_at
    FROM attendance
    WHERE employee_id = ? AND attendance_date BETWEEN ? AND ?
    ORDER BY attendance_date ASC
  `;
  const [records] = await pool.query(query, [employeeId, startDate, endDate]);

  return {
    records,
    startDate,
    endDate,
    daysInMonth: lastDay
  };
};

/**
 * Fetch summary statistics for an employee over an optional date range
 */
const getSummaryStats = async (employeeId, { fromDate, toDate } = {}) => {
  const conditions = ['employee_id = ?'];
  const params = [employeeId];

  if (fromDate) {
    conditions.push('attendance_date >= ?');
    params.push(fromDate);
  }
  if (toDate) {
    conditions.push('attendance_date <= ?');
    params.push(toDate);
  }

  const whereClause = conditions.join(' AND ');

  const query = `
    SELECT 
      COUNT(*) AS totalRecords,
      COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0) AS completedRecords,
      COALESCE(SUM(CASE WHEN status = 'present' AND check_out_time IS NULL THEN 1 ELSE 0 END), 0) AS incompleteRecords,
      COALESCE(SUM(COALESCE(working_minutes, 0)), 0) AS totalWorkingMinutes,
      ROUND(AVG(CASE WHEN status = 'completed' THEN working_minutes ELSE NULL END), 1) AS averageWorkingMinutes
    FROM attendance
    WHERE ${whereClause}
  `;

  const [rows] = await pool.query(query, params);
  const row = rows[0] || {};

  return {
    totalRecords: Number(row.totalRecords) || 0,
    completedRecords: Number(row.completedRecords) || 0,
    incompleteRecords: Number(row.incompleteRecords) || 0,
    totalWorkingMinutes: Number(row.totalWorkingMinutes) || 0,
    averageWorkingMinutes: row.averageWorkingMinutes != null ? Number(row.averageWorkingMinutes) : 0
  };
};

module.exports = {
  findById,
  findByEmployeeAndDate,
  createCheckIn,
  updateCheckOut,
  getHistory,
  getMonthlyRecords,
  getSummaryStats
};
