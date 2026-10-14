const {
  findByEmployeeAndDate,
  createCheckIn,
  updateCheckOut,
  getHistory,
  getMonthlyRecords,
  getSummaryStats
} = require('../models/attendanceModel');
const { calculateHaversineDistance, isValidCoordinate } = require('../utils/distance');
const {
  getTodayDateString,
  getCurrentTimeString,
  calculateWorkingMinutes,
  formatWorkingDuration,
  checkIsLate,
  checkIsEarlyCheckout,
  isValidDateFormat
} = require('../utils/time');
const { getOrganizationConfig } = require('../services/organizationConfigService');
const {
  notifyAttendanceCheckIn,
  notifyAttendanceCheckOut
} = require('../services/notificationService');
const { sendSuccess, sendError } = require('../utils/response');

/**
 * Record Employee Check-In
 * POST /api/v1/attendance/check-in
 */
const checkIn = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { latitude, longitude, accuracy, isMocked, mocked } = req.body;

    // 0. Mock location anti-spoofing validation
    if (isMocked === true || mocked === true) {
      return sendError(res, 'Mock location detected. Attendance cannot be recorded.', 403);
    }

    // 1. Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      return sendError(res, 'Latitude and longitude are required', 400);
    }

    if (!isValidCoordinate(latitude, longitude)) {
      return sendError(res, 'Invalid GPS coordinates format', 400);
    }

    // Validate GPS accuracy if provided
    const maxAccuracy = parseFloat(process.env.MAX_ALLOWED_ACCURACY_METERS) || 50;
    if (accuracy !== undefined && accuracy !== null) {
      const numAccuracy = parseFloat(accuracy);
      if (isNaN(numAccuracy) || numAccuracy < 0 || numAccuracy > maxAccuracy) {
        return sendError(res, `GPS accuracy is too low (${Math.round(numAccuracy)}m). Please wait for a better GPS signal.`, 400);
      }
    }

    // 2. Obtain organization location configuration
    const orgConfig = await getOrganizationConfig();
    if (!orgConfig.isConfigured) {
      return sendError(res, 'Organization location is not configured', 500);
    }

    // 3. Server-side Haversine distance validation
    const distanceMeters = calculateHaversineDistance(
      latitude,
      longitude,
      orgConfig.latitude,
      orgConfig.longitude
    );

    if (distanceMeters > orgConfig.radiusMeters) {
      return res.status(403).json({
        success: false,
        message: `Attendance can only be marked within ${orgConfig.radiusMeters} meters of the organization.`,
        data: {
          currentDistance: distanceMeters,
          allowedRadius: orgConfig.radiusMeters
        }
      });
    }

    // 4. Check if employee already checked in today
    const todayDate = getTodayDateString(orgConfig.timezone);
    const existingRecord = await findByEmployeeAndDate(employeeId, todayDate);

    if (existingRecord) {
      return sendError(res, 'Attendance already checked in for today', 409);
    }

    // 5. Generate server-side timestamp and record check-in
    const checkInTime = getCurrentTimeString(orgConfig.timezone);
    const newRecord = await createCheckIn({
      employee_id: employeeId,
      attendance_date: todayDate,
      check_in_time: checkInTime,
      check_in_latitude: latitude,
      check_in_longitude: longitude,
      check_in_accuracy: accuracy
    });

    const isLate = checkIsLate(checkInTime, orgConfig.startTime);

    // Create employee notification
    try {
      await notifyAttendanceCheckIn(employeeId, {
        time: checkInTime,
        isLate,
        distanceMeters,
        attendanceId: newRecord.id
      });
    } catch (err) {
      console.warn('[Attendance Notification Warning]', err.message);
    }

    return res.status(201).json({
      success: true,
      message: 'Attendance marked successfully',
      data: {
        attendance: {
          ...newRecord,
          isLate,
          workingHoursFormatted: '0h 0m'
        },
        distanceMeters
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Record Employee Check-Out
 * POST /api/v1/attendance/check-out
 */
const checkOut = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { latitude, longitude, accuracy, isMocked, mocked } = req.body;

    // 0. Mock location anti-spoofing validation
    if (isMocked === true || mocked === true) {
      return sendError(res, 'Mock location detected. Attendance cannot be recorded.', 403);
    }

    // 1. Validate coordinates
    if (latitude === undefined || longitude === undefined) {
      return sendError(res, 'Latitude and longitude are required', 400);
    }

    if (!isValidCoordinate(latitude, longitude)) {
      return sendError(res, 'Invalid GPS coordinates format', 400);
    }

    // Validate GPS accuracy if provided
    const maxAccuracy = parseFloat(process.env.MAX_ALLOWED_ACCURACY_METERS) || 50;
    if (accuracy !== undefined && accuracy !== null) {
      const numAccuracy = parseFloat(accuracy);
      if (isNaN(numAccuracy) || numAccuracy < 0 || numAccuracy > maxAccuracy) {
        return sendError(res, `GPS accuracy is too low (${Math.round(numAccuracy)}m). Please wait for a better GPS signal.`, 400);
      }
    }

    // 2. Obtain organization location configuration
    const orgConfig = await getOrganizationConfig();
    if (!orgConfig.isConfigured) {
      return sendError(res, 'Organization location is not configured', 500);
    }

    // 3. Server-side Haversine distance validation
    const distanceMeters = calculateHaversineDistance(
      latitude,
      longitude,
      orgConfig.latitude,
      orgConfig.longitude
    );

    if (distanceMeters > orgConfig.radiusMeters) {
      return res.status(403).json({
        success: false,
        message: `Attendance can only be marked within ${orgConfig.radiusMeters} meters of the organization.`,
        data: {
          currentDistance: distanceMeters,
          allowedRadius: orgConfig.radiusMeters
        }
      });
    }

    // 4. Find today's attendance record
    const todayDate = getTodayDateString(orgConfig.timezone);
    const existingRecord = await findByEmployeeAndDate(employeeId, todayDate);

    if (!existingRecord) {
      return sendError(res, 'No check-in record found for today. Please mark attendance first.', 404);
    }

    if (existingRecord.check_out_time) {
      return sendError(res, 'You have already marked OUT for today', 409);
    }

    // 5. Generate server-side checkout timestamp & calculate working minutes
    const checkOutTime = getCurrentTimeString(orgConfig.timezone);
    const workingMinutes = calculateWorkingMinutes(existingRecord.check_in_time, checkOutTime);

    const updatedRecord = await updateCheckOut(existingRecord.id, {
      check_out_time: checkOutTime,
      check_out_latitude: latitude,
      check_out_longitude: longitude,
      check_out_accuracy: accuracy,
      working_minutes: workingMinutes
    });

    const isLate = checkIsLate(updatedRecord.check_in_time, orgConfig.startTime);
    const isEarlyCheckout = checkIsEarlyCheckout(checkOutTime, orgConfig.endTime);

    // Create employee notification
    try {
      await notifyAttendanceCheckOut(employeeId, {
        time: checkOutTime,
        durationFormatted: formatWorkingDuration(workingMinutes),
        isEarlyCheckout,
        attendanceId: updatedRecord.id
      });
    } catch (err) {
      console.warn('[Attendance Notification Warning]', err.message);
    }

    return sendSuccess(res, 'Out marked successfully', {
      attendance: {
        ...updatedRecord,
        isLate,
        isEarlyCheckout,
        workingHoursFormatted: formatWorkingDuration(workingMinutes)
      },
      workingMinutes,
      distanceMeters
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Today's Attendance Status
 * GET /api/v1/attendance/today
 */
const getTodayAttendance = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const orgConfig = await getOrganizationConfig();
    const todayDate = getTodayDateString(orgConfig.timezone);

    const record = await findByEmployeeAndDate(employeeId, todayDate);

    let enrichedRecord = null;
    if (record) {
      enrichedRecord = {
        ...record,
        isLate: checkIsLate(record.check_in_time, orgConfig.startTime),
        isEarlyCheckout: record.check_out_time
          ? checkIsEarlyCheckout(record.check_out_time, orgConfig.endTime)
          : null,
        workingHoursFormatted: formatWorkingDuration(record.working_minutes)
      };
    }

    return sendSuccess(res, "Today's attendance retrieved", {
      attendance: enrichedRecord,
      isCheckedIn: Boolean(record),
      isCheckedOut: Boolean(record && record.check_out_time),
      todayDate,
      organization: {
        latitude: orgConfig.latitude,
        longitude: orgConfig.longitude,
        radiusMeters: orgConfig.radiusMeters,
        startTime: orgConfig.startTime,
        endTime: orgConfig.endTime
      }
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Attendance History with filters and pagination
 * GET /api/v1/attendance/history
 */
const getAttendanceHistory = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { fromDate, toDate, status, page, limit } = req.query;

    // Validate fromDate
    if (fromDate && !isValidDateFormat(fromDate)) {
      return sendError(res, 'Invalid fromDate format. Expected YYYY-MM-DD', 400);
    }

    // Validate toDate
    if (toDate && !isValidDateFormat(toDate)) {
      return sendError(res, 'Invalid toDate format. Expected YYYY-MM-DD', 400);
    }

    // Validate date range
    if (fromDate && toDate && fromDate > toDate) {
      return sendError(res, 'fromDate cannot be after toDate', 400);
    }

    // Validate status
    if (status && !['present', 'completed'].includes(status.toLowerCase())) {
      return sendError(res, "Invalid status filter. Allowed values: 'present', 'completed'", 400);
    }

    const orgConfig = await getOrganizationConfig();
    const historyResult = await getHistory(employeeId, {
      fromDate,
      toDate,
      status: status ? status.toLowerCase() : null,
      page,
      limit
    });

    // Enrich records with late, early checkout, and duration formatting
    const enrichedRecords = historyResult.records.map((rec) => ({
      ...rec,
      isLate: checkIsLate(rec.check_in_time, orgConfig.startTime),
      isEarlyCheckout: rec.check_out_time
        ? checkIsEarlyCheckout(rec.check_out_time, orgConfig.endTime)
        : null,
      workingHoursFormatted: formatWorkingDuration(rec.working_minutes)
    }));

    return sendSuccess(res, 'Attendance history retrieved successfully', {
      records: enrichedRecords,
      pagination: historyResult.pagination
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Monthly Attendance and Summary
 * GET /api/v1/attendance/monthly
 */
const getMonthlyAttendance = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const orgConfig = await getOrganizationConfig();

    const todayDate = getTodayDateString(orgConfig.timezone);
    const [currentYear, currentMonth] = todayDate.split('-').map(Number);

    let year = parseInt(req.query.year, 10);
    let month = parseInt(req.query.month, 10);

    if (req.query.month && typeof req.query.month === 'string' && req.query.month.includes('-')) {
      const parts = req.query.month.split('-');
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10);
    } else {
      year = year || currentYear;
      month = month || currentMonth;
    }

    if (isNaN(year) || year < 1900 || year > 2100) {
      return sendError(res, 'Invalid year parameter', 400);
    }
    if (isNaN(month) || month < 1 || month > 12) {
      return sendError(res, 'Invalid month parameter (must be 1-12)', 400);
    }

    const monthlyResult = await getMonthlyRecords(employeeId, year, month);

    let lateCount = 0;
    let earlyCheckoutCount = 0;
    let completedDays = 0;
    let incompleteDays = 0;
    let totalWorkingMinutes = 0;

    const enrichedRecords = monthlyResult.records.map((rec) => {
      const isLate = checkIsLate(rec.check_in_time, orgConfig.startTime);
      const isEarly = rec.check_out_time
        ? checkIsEarlyCheckout(rec.check_out_time, orgConfig.endTime)
        : null;

      if (isLate === true) lateCount++;
      if (isEarly === true) earlyCheckoutCount++;

      if (rec.status === 'completed') {
        completedDays++;
        totalWorkingMinutes += rec.working_minutes || 0;
      } else {
        incompleteDays++;
      }

      return {
        ...rec,
        isLate,
        isEarlyCheckout: isEarly,
        workingHoursFormatted: formatWorkingDuration(rec.working_minutes)
      };
    });

    const presentDays = monthlyResult.records.length;
    const averageWorkingMinutes =
      completedDays > 0 ? Math.round(totalWorkingMinutes / completedDays) : 0;

    const summary = {
      totalDays: monthlyResult.daysInMonth,
      presentDays,
      completedDays,
      incompleteDays,
      lateDays: lateCount,
      earlyCheckoutDays: earlyCheckoutCount,
      totalWorkingMinutes,
      totalWorkingHoursFormatted: formatWorkingDuration(totalWorkingMinutes),
      averageWorkingMinutes,
      averageWorkingHoursFormatted: formatWorkingDuration(averageWorkingMinutes)
    };

    return sendSuccess(res, 'Monthly attendance retrieved successfully', {
      year,
      month,
      records: enrichedRecords,
      summary
    }, 200);
  } catch (error) {
    next(error);
  }
};

/**
 * Get Attendance Summary Statistics
 * GET /api/v1/attendance/summary
 */
const getAttendanceSummary = async (req, res, next) => {
  try {
    const employeeId = req.employee.id;
    const { fromDate, toDate } = req.query;

    if (fromDate && !isValidDateFormat(fromDate)) {
      return sendError(res, 'Invalid fromDate format. Expected YYYY-MM-DD', 400);
    }
    if (toDate && !isValidDateFormat(toDate)) {
      return sendError(res, 'Invalid toDate format. Expected YYYY-MM-DD', 400);
    }
    if (fromDate && toDate && fromDate > toDate) {
      return sendError(res, 'fromDate cannot be after toDate', 400);
    }

    const orgConfig = await getOrganizationConfig();
    const stats = await getSummaryStats(employeeId, { fromDate, toDate });

    // Query records to compute late/early counts if shift timings configured
    let lateCount = 0;
    let earlyCheckoutCount = 0;

    if (orgConfig.startTime || orgConfig.endTime) {
      const historyData = await getHistory(employeeId, {
        fromDate,
        toDate,
        limit: 1000
      });

      historyData.records.forEach((rec) => {
        if (checkIsLate(rec.check_in_time, orgConfig.startTime) === true) lateCount++;
        if (
          rec.check_out_time &&
          checkIsEarlyCheckout(rec.check_out_time, orgConfig.endTime) === true
        ) {
          earlyCheckoutCount++;
        }
      });
    }

    const summary = {
      ...stats,
      lateCount,
      earlyCheckoutCount,
      totalWorkingHoursFormatted: formatWorkingDuration(stats.totalWorkingMinutes),
      averageWorkingHoursFormatted: formatWorkingDuration(Math.round(stats.averageWorkingMinutes))
    };

    return sendSuccess(res, 'Attendance summary retrieved successfully', {
      summary,
      filters: {
        fromDate: fromDate || null,
        toDate: toDate || null
      }
    }, 200);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getMonthlyAttendance,
  getAttendanceSummary
};
