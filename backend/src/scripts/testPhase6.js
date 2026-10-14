const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../app');
const { pool } = require('../config/database');
const notificationService = require('../services/notificationService');
const { seedLeaveData } = require('./seedLeaveData');

async function runPhase6TestSuite() {
  console.log('================================================================');
  console.log('   PHASE 6 — NOTIFICATIONS, SECURITY & REGRESSION TEST SUITE    ');
  console.log('================================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  [PASS] #${total} ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] #${total} ${message}`);
      throw new Error(`Test #${total} failed: ${message}`);
    }
  }

  // 1. Reset / re-seed leave test data
  console.log('Setup: Preparing test data and employee records...');
  await seedLeaveData();

  // Clean test tables for employee 1 and 2
  await pool.query('DELETE FROM notifications WHERE employee_id IN (1, 2)');
  await pool.query('DELETE FROM leave_requests WHERE employee_id = 1');
  await pool.query('DELETE FROM half_day_requests WHERE employee_id = 1');
  await pool.query('DELETE FROM permission_requests WHERE employee_id = 1');

  // Reset leave balance for current year
  const currentYear = new Date().getFullYear();
  await pool.query(`
    UPDATE employee_leave_balances
    SET used_days = 0, pending_days = 0, remaining_days = total_days
    WHERE employee_id = 1 AND year = ?
  `, [currentYear]);

  // Clean today's attendance record for employee 1
  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
  await pool.query('DELETE FROM attendance WHERE employee_id = 1 AND attendance_date = ?', [todayStr]);

  // Start in-process test HTTP server
  const TEST_PORT = 5057;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${TEST_PORT}/api/v1`;

  // Standard skip-rate-limit header for functional tests (rate limiter tests will omit this)
  const testHeaders = {
    'Content-Type': 'application/json',
    'X-Skip-Rate-Limit': 'true'
  };

  try {
    // =============================================================
    // SECTION 1: PHASE 1 & 2 REGRESSION (Health, DB, Auth, Profile)
    // =============================================================
    console.log('\n--- SECTION 1: PHASE 1 & 2 REGRESSION TESTS ---');

    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.success === true, 'GET /api/v1/health operational');

    // 2. Security Headers (Helmet)
    const nosniffHeader = healthRes.headers.get('x-content-type-options');
    assert(nosniffHeader === 'nosniff', 'Security header X-Content-Type-Options: nosniff present');

    // 3. Employee Login
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify({ email: 'employee@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && loginData.data?.token !== undefined, 'POST /api/v1/auth/login authenticates employee');

    const token = loginData.data.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'X-Skip-Rate-Limit': 'true'
    };

    // 4. Password hash must never be returned in login response
    assert(loginData.data.employee.password_hash === undefined, 'Sensitive field password_hash not exposed in login response');

    // 5. Employee Profile
    const profileRes = await fetch(`${baseUrl}/employees/me`, { headers: authHeaders });
    const profileData = await profileRes.json();
    assert(profileRes.status === 200 && profileData.data.employee.email === 'employee@example.com', 'GET /api/v1/employees/me retrieves profile');
    assert(profileData.data.employee.password_hash === undefined, 'Sensitive field password_hash not exposed in profile response');

    // =============================================================
    // SECTION 2: NOTIFICATIONS ARCHITECTURE & APIS
    // =============================================================
    console.log('\n--- SECTION 2: NOTIFICATIONS ARCHITECTURE & API TESTS ---');

    // 6. Unauthenticated access to notifications rejected
    const unauthNotifRes = await fetch(`${baseUrl}/notifications`);
    assert(unauthNotifRes.status === 401, 'Unauthenticated GET /api/v1/notifications rejected with 401');

    // 7. Notification creation via notificationService
    const createdNotif = await notificationService.createNotification({
      employee_id: 1,
      title: 'Welcome to Notifications',
      message: 'This is a test notification verifying Phase 6.',
      type: 'general',
      reference_id: null
    });
    assert(createdNotif && createdNotif.id > 0, 'notificationService creates notification record with valid ID');

    // 8. Notification database persistence verification
    const [dbRows] = await pool.query('SELECT * FROM notifications WHERE id = ?', [createdNotif.id]);
    assert(dbRows.length === 1 && dbRows[0].is_read === 0, 'Notification persisted in MySQL with is_read = 0');

    // 9. Employee retrieves notifications list
    const notifListRes = await fetch(`${baseUrl}/notifications`, { headers: authHeaders });
    const notifListData = await notifListRes.json();
    assert(notifListRes.status === 200 && notifListData.data.notifications.length >= 1, 'GET /api/v1/notifications returns notifications array');

    // 10. Unread count API
    const unreadRes = await fetch(`${baseUrl}/notifications/unread-count`, { headers: authHeaders });
    const unreadData = await unreadRes.json();
    assert(unreadRes.status === 200 && unreadData.data.unreadCount >= 1, 'GET /api/v1/notifications/unread-count returns accurate count');

    // 11. Mark single notification as read
    const markReadRes = await fetch(`${baseUrl}/notifications/${createdNotif.id}/read`, {
      method: 'PATCH',
      headers: authHeaders
    });
    const markReadData = await markReadRes.json();
    assert(markReadRes.status === 200 && markReadData.success === true, 'PATCH /api/v1/notifications/:id/read marks notification as read');

    // 12. Verify single notification read state in DB
    const [updatedDb] = await pool.query('SELECT is_read FROM notifications WHERE id = ?', [createdNotif.id]);
    assert(updatedDb[0].is_read === 1, 'Notification is_read flag updated to 1 in MySQL database');

    // 13. Create multiple notifications to test mark-all
    await notificationService.createNotification({
      employee_id: 1,
      title: 'Update 1',
      message: 'Unread update 1',
      type: 'attendance'
    });
    await notificationService.createNotification({
      employee_id: 1,
      title: 'Update 2',
      message: 'Unread update 2',
      type: 'leave'
    });

    // 14. Mark all as read
    const markAllRes = await fetch(`${baseUrl}/notifications/read-all`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(markAllRes.status === 200, 'PATCH /api/v1/notifications/read-all succeeds with 200');

    // 15. Verify unread count is now 0
    const unreadAfterAll = await fetch(`${baseUrl}/notifications/unread-count`, { headers: authHeaders });
    const unreadAfterAllData = await unreadAfterAll.json();
    assert(unreadAfterAllData.data.unreadCount === 0, 'Unread count is 0 after mark-all-read');

    // 16. Employee isolation: create notification for Employee 2
    const emp2Notif = await notificationService.createNotification({
      employee_id: 2,
      title: 'Private Notice for Emp 2',
      message: 'Confidential alert for Employee 2.',
      type: 'general'
    });

    // 17. Employee 1 must NOT see Employee 2 notification
    const emp1ListRes = await fetch(`${baseUrl}/notifications`, { headers: authHeaders });
    const emp1ListData = await emp1ListRes.json();
    const hasEmp2Notif = emp1ListData.data.notifications.some(n => n.id === emp2Notif.id);
    assert(!hasEmp2Notif, 'Employee 1 cannot see Employee 2 notification in list');

    // 18. Employee_id spoofing ignored on notification query
    const spoofedListRes = await fetch(`${baseUrl}/notifications?employee_id=2`, { headers: authHeaders });
    const spoofedListData = await spoofedListRes.json();
    const hasSpoofedEmp2 = spoofedListData.data.notifications.some(n => n.id === emp2Notif.id);
    assert(!hasSpoofedEmp2, 'Notification query ignores employee_id query spoofing');

    // 19. URL ID manipulation: Employee 1 cannot mark Employee 2 notification as read
    const crossMarkRes = await fetch(`${baseUrl}/notifications/${emp2Notif.id}/read`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(crossMarkRes.status === 404, 'Employee 1 cannot mark Employee 2 notification as read (returns 404)');

    // =============================================================
    // SECTION 3: NOTIFICATION LIFECYCLE EVENTS
    // =============================================================
    console.log('\n--- SECTION 3: NOTIFICATION LIFECYCLE EVENTS ---');

    // 20. Check-in event creates notification
    const checkInRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 5.0
      })
    });
    assert(checkInRes.status === 201, 'Attendance check-in succeeds with 201');

    const [checkInNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'attendance' AND title LIKE '%Check-In%' ORDER BY id DESC LIMIT 1"
    );
    assert(checkInNotifs.length === 1, 'Check-in automatically dispatches attendance notification');

    // 21. Check-out event creates notification
    const checkOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 5.0
      })
    });
    assert(checkOutRes.status === 200, 'Attendance check-out succeeds with 200');

    const [checkOutNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'attendance' AND title LIKE '%Check-Out%' ORDER BY id DESC LIMIT 1"
    );
    assert(checkOutNotifs.length === 1, 'Check-out automatically dispatches attendance notification');

    // 22. Leave request event creates notification
    const leaveRes = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: 1,
        fromDate: '2026-11-10',
        toDate: '2026-11-11',
        reason: 'Personal vacation'
      })
    });
    const leaveData = await leaveRes.json();
    assert(leaveRes.status === 201, 'Leave application submitted with 201');

    const [leaveNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'leave' AND title LIKE '%Submitted%' ORDER BY id DESC LIMIT 1"
    );
    assert(leaveNotifs.length === 1, 'Leave application automatically dispatches leave notification');

    // 23. Leave cancellation event creates notification
    const leaveId = leaveData.data?.id || leaveData.data?.leave?.id;
    const leaveCancelRes = await fetch(`${baseUrl}/leaves/${leaveId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(leaveCancelRes.status === 200, 'Leave cancellation succeeds with 200');

    const [leaveCancelNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'leave' AND title LIKE '%Cancelled%' ORDER BY id DESC LIMIT 1"
    );
    assert(leaveCancelNotifs.length === 1, 'Leave cancellation automatically dispatches cancellation notification');

    // 24. Half-Day request event creates notification
    const halfDayRes = await fetch(`${baseUrl}/half-days`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        halfDayDate: '2026-12-01',
        session: 'first_half',
        reason: 'Dentist appointment'
      })
    });
    const halfDayData = await halfDayRes.json();
    assert(halfDayRes.status === 201, 'Half-day application submitted with 201');

    const [halfDayNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'half_day' AND title LIKE '%Submitted%' ORDER BY id DESC LIMIT 1"
    );
    assert(halfDayNotifs.length === 1, 'Half-day application automatically dispatches half-day notification');

    // 25. Half-Day cancellation event creates notification
    const halfDayId = halfDayData.data?.id || halfDayData.data?.halfDay?.id;
    const halfDayCancelRes = await fetch(`${baseUrl}/half-days/${halfDayId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(halfDayCancelRes.status === 200, 'Half-day cancellation succeeds with 200');

    const [halfDayCancelNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'half_day' AND title LIKE '%Cancelled%' ORDER BY id DESC LIMIT 1"
    );
    assert(halfDayCancelNotifs.length === 1, 'Half-day cancellation automatically dispatches notification');

    // 26. Permission request event creates notification
    const permRes = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        permissionDate: '2026-12-05',
        fromTime: '10:00:00',
        toTime: '11:00:00',
        reason: 'Bank visit'
      })
    });
    const permData = await permRes.json();
    assert(permRes.status === 201, 'Permission application submitted with 201');

    const [permNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'permission' AND title LIKE '%Submitted%' ORDER BY id DESC LIMIT 1"
    );
    assert(permNotifs.length === 1, 'Permission application automatically dispatches permission notification');

    // 27. Permission cancellation event creates notification
    const permId = permData.data?.id || permData.data?.permission?.id;
    const permCancelRes = await fetch(`${baseUrl}/permissions/${permId}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(permCancelRes.status === 200, 'Permission cancellation succeeds with 200');

    const [permCancelNotifs] = await pool.query(
      "SELECT * FROM notifications WHERE employee_id = 1 AND type = 'permission' AND title LIKE '%Cancelled%' ORDER BY id DESC LIMIT 1"
    );
    assert(permCancelNotifs.length === 1, 'Permission cancellation automatically dispatches notification');

    // =============================================================
    // SECTION 4: SECURITY & GPS ANTI-SPOOFING HARDENING
    // =============================================================
    console.log('\n--- SECTION 4: SECURITY & ANTI-SPOOFING TESTS ---');

    // 28. Invalid JWT rejected
    const badJwtRes = await fetch(`${baseUrl}/employees/me`, {
      headers: { Authorization: 'Bearer thisisnotavalidjwttoken' }
    });
    assert(badJwtRes.status === 401, 'Invalid JWT token rejected with 401');

    // 29. Malformed Authorization header rejected
    const malformedAuthRes = await fetch(`${baseUrl}/employees/me`, {
      headers: { Authorization: 'Basic dXNlcm5hbWU6cGFzc3dvcmQ=' }
    });
    assert(malformedAuthRes.status === 401, 'Malformed Authorization header rejected with 401');

    // 30. Expired JWT handling
    const expiredToken = jwt.sign(
      { id: 1, email: 'employee@example.com' },
      process.env.JWT_SECRET || 'attendance_dev_jwt_secret_key_2026',
      { expiresIn: '-10s' }
    );
    const expiredRes = await fetch(`${baseUrl}/employees/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert(expiredRes.status === 401, 'Expired JWT token rejected with 401');

    // 31. Mock location rejection (isMocked = true)
    const mockGpsRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 5.0,
        isMocked: true
      })
    });
    const mockGpsData = await mockGpsRes.json();
    assert(mockGpsRes.status === 403, 'Mock location (isMocked: true) rejected with HTTP 403');
    assert(mockGpsData.message?.includes('Mock location detected'), 'Mock location rejection returns clear message');

    // 32. GPS Accuracy threshold check (> 50m rejected)
    const inaccurateGpsRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 120.0
      })
    });
    assert(inaccurateGpsRes.status === 400, 'Inaccurate GPS location (> 50m) rejected with 400');

    // 33. GPS distance validation (outside 10m radius rejected)
    const outsideRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.525000,
        longitude: 73.815000,
        accuracy: 5.0
      })
    });
    assert(outsideRes.status === 403, 'Coordinates outside 10m office radius rejected with 403');

    // 34. Input validation: coordinates out of range (-90 to +90)
    const invalidCoordsRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 195.0,
        longitude: 73.808722,
        accuracy: 5.0
      })
    });
    assert(invalidCoordsRes.status === 400, 'Out-of-range latitude (> 90) rejected with 400');

    // 35. Input validation: invalid date format
    const badDateRes = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: 1,
        fromDate: 'invalid-date',
        toDate: '2026-11-15',
        reason: 'Holiday'
      })
    });
    assert(badDateRes.status === 400, 'Invalid date format rejected with 400');

    // 36. Input validation: invalid time format
    const badTimeRes = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        permissionDate: '2026-12-10',
        fromTime: 'bad-time',
        toTime: '11:00:00',
        reason: 'Bank'
      })
    });
    assert(badTimeRes.status === 400, 'Invalid time format rejected with 400');

    // 37. SQL Injection style string handled safely
    const sqliRes = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: 1,
        fromDate: '2026-11-20',
        toDate: '2026-11-21',
        reason: "'; DROP TABLE test_injection; --"
      })
    });
    // Request is handled cleanly without internal 500 or SQL error (either 201 or 409)
    assert([201, 400, 409].includes(sqliRes.status), 'SQL injection characters in reason handled safely via parameterized query');

    // 38. Oversized request body (> 100kb limit)
    const largePayload = {
      email: 'employee@example.com',
      password: 'password123',
      junk: 'X'.repeat(120 * 1024) // 120KB
    };
    const oversizeRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: testHeaders,
      body: JSON.stringify(largePayload)
    });
    assert(oversizeRes.status === 413, 'Oversized request body (> 100kb) rejected with 413 Payload Too Large');

    // 39. Rate limiting on sensitive auth endpoints
    console.log('Testing rate limiting on /auth/login...');
    let rateLimited = false;
    // Perform rapid calls without X-Skip-Rate-Limit header to test authLimiter
    for (let i = 0; i < 20; i++) {
      const rlRes = await fetch(`${baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'bad_test@example.com', password: 'wrong' })
      });
      if (rlRes.status === 429) {
        rateLimited = true;
        break;
      }
    }
    assert(rateLimited, 'Excessive login requests trigger 429 Too Many Requests rate limit');

    // =============================================================
    // SECTION 5: COMPLETE REGRESSION VERIFICATION (Phases 3, 4, 5)
    // =============================================================
    console.log('\n--- SECTION 5: COMPLETE REGRESSION VERIFICATION ---');

    // 40. Attendance History
    const attHistRes = await fetch(`${baseUrl}/attendance/history`, { headers: authHeaders });
    const attHistData = await attHistRes.json();
    assert(attHistRes.status === 200 && Array.isArray(attHistData.data.records), 'GET /api/v1/attendance/history operational');

    // 41. Monthly Attendance
    const attMonthRes = await fetch(`${baseUrl}/attendance/monthly?month=2026-10`, { headers: authHeaders });
    assert(attMonthRes.status === 200, 'GET /api/v1/attendance/monthly operational');

    // 42. Attendance Summary
    const attSumRes = await fetch(`${baseUrl}/attendance/summary`, { headers: authHeaders });
    const attSumData = await attSumRes.json();
    assert(attSumRes.status === 200 && attSumData.data.summary !== undefined, 'GET /api/v1/attendance/summary operational');

    // 43. Leave Types
    const leaveTypesRes = await fetch(`${baseUrl}/leaves/types`, { headers: authHeaders });
    assert(leaveTypesRes.status === 200, 'GET /api/v1/leaves/types operational');

    // 44. Leave Balances
    const leaveBalRes = await fetch(`${baseUrl}/leaves/balance?year=2026`, { headers: authHeaders });
    assert(leaveBalRes.status === 200, 'GET /api/v1/leaves/balance operational');

    // 45. Leave History
    const leaveHistRes = await fetch(`${baseUrl}/leaves`, { headers: authHeaders });
    assert(leaveHistRes.status === 200, 'GET /api/v1/leaves operational');

    // 46. Half-day History
    const hdHistRes = await fetch(`${baseUrl}/half-days`, { headers: authHeaders });
    assert(hdHistRes.status === 200, 'GET /api/v1/half-days operational');

    // 47. Permission History
    const permHistRes = await fetch(`${baseUrl}/permissions`, { headers: authHeaders });
    assert(permHistRes.status === 200, 'GET /api/v1/permissions operational');

    // 48. Logout
    const logoutRes = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: authHeaders
    });
    assert(logoutRes.status === 200, 'POST /api/v1/auth/logout operational');

  } finally {
    server.close();
  }

  console.log(`\n================================================================`);
  console.log(`   ALL ${passed} of ${total} PHASE 6 & REGRESSION TESTS PASSED!`);
  console.log(`================================================================`);
}

if (require.main === module) {
  runPhase6TestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runPhase6TestSuite };
