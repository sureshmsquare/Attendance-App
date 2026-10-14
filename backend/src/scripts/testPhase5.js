const http = require('http');
const app = require('../app');
const { pool } = require('../config/database');
const { seedLeaveData } = require('./seedLeaveData');

async function runPhase5TestSuite() {
  console.log('================================================================');
  console.log('   PHASE 5 — LEAVE, HALF-DAY & PERMISSION TEST SUITE           ');
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
  console.log('Setup: Seeding leave types and test employee balances...');
  await seedLeaveData();

  // Clean up any existing test leave/halfday/permission records for employee 1
  await pool.query('DELETE FROM leave_requests WHERE employee_id = 1');
  await pool.query('DELETE FROM half_day_requests WHERE employee_id = 1');
  await pool.query('DELETE FROM permission_requests WHERE employee_id = 1');
  // Reset balances for employee 1 for current year
  const currentYear = new Date().getFullYear();
  await pool.query(`
    UPDATE employee_leave_balances
    SET used_days = 0, pending_days = 0, remaining_days = total_days
    WHERE employee_id = 1 AND year = ?
  `, [currentYear]);

  // Start in-process test HTTP server
  const TEST_PORT = 5056;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${TEST_PORT}/api/v1`;

  try {
    // -------------------------------------------------------------
    // AUTHENTICATION TESTS
    // -------------------------------------------------------------
    console.log('\n--- AUTHENTICATION VERIFICATION ---');

    // Test: Unauthenticated request rejected
    const unauthRes = await fetch(`${baseUrl}/leaves`);
    assert(unauthRes.status === 401, 'Unauthenticated request to /leaves is rejected with 401');

    // Test: Authenticate employee
    const loginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'employee@example.com', password: 'password123' })
    });
    const loginData = await loginRes.json();
    assert(loginRes.status === 200 && Boolean(loginData.data.token), 'Authenticated employee accepted and token generated');
    const token = loginData.data.token;
    const authHeaders = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };

    // Get active leave types
    const typesRes = await fetch(`${baseUrl}/leaves/types`, { headers: authHeaders });
    const typesData = await typesRes.json();
    assert(typesRes.status === 200 && typesData.data.length >= 3, 'Active leave types retrieved (CL, SL, EL)');
    const clType = typesData.data.find(t => t.code === 'CL');
    const slType = typesData.data.find(t => t.code === 'SL');
    assert(Boolean(clType && slType), 'Casual Leave and Sick Leave found');

    // -------------------------------------------------------------
    // LEAVE TESTS (1 - 10)
    // -------------------------------------------------------------
    console.log('\n--- LEAVE TESTS (1 - 10) ---');

    // Test 1: Apply leave successfully
    const applyRes1 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: clType.id,
        fromDate: `${currentYear}-11-10`,
        toDate: `${currentYear}-11-12`,
        reason: 'Family event out of town'
      })
    });
    const applyData1 = await applyRes1.json();
    assert(applyRes1.status === 201, '1. Apply leave successfully (status 201)');
    assert(applyData1.data.total_days === 3, 'Total days calculated server-side as 3 days');
    assert(applyData1.data.status === 'pending', 'Initial leave status is pending');
    const leaveId1 = applyData1.data.id;

    // Verify balance was adjusted
    const balRes1 = await fetch(`${baseUrl}/leaves/balance?year=${currentYear}`, { headers: authHeaders });
    const balData1 = await balRes1.json();
    const clBal = balData1.data.balances.find(b => b.leave_type_code === 'CL');
    assert(parseFloat(clBal.pending_days) === 3.0 && parseFloat(clBal.remaining_days) === 9.0, 'Balance pending increased to 3 and remaining decreased to 9');

    // Test 2: Invalid date range rejected (fromDate > toDate)
    const applyRes2 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: clType.id,
        fromDate: `${currentYear}-11-15`,
        toDate: `${currentYear}-11-10`,
        reason: 'Invalid inverted dates'
      })
    });
    assert(applyRes2.status === 400, '2. Invalid date range (fromDate > toDate) rejected with 400');

    // Test 3: Insufficient balance rejected
    const applyRes3 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: clType.id,
        fromDate: `${currentYear}-12-01`,
        toDate: `${currentYear}-12-25`, // 25 days, available is 9
        reason: 'Too many days'
      })
    });
    assert(applyRes3.status === 400, '3. Insufficient balance rejected with 400');

    // Test 4: Overlapping leave rejected
    const applyRes4 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: slType.id,
        fromDate: `${currentYear}-11-11`, // Overlaps with Nov 10-12
        toDate: `${currentYear}-11-14`,
        reason: 'Overlap attempt'
      })
    });
    assert(applyRes4.status === 409, '4. Overlapping active leave rejected with 409');

    // Test 5: Duplicate active leave rejected
    const applyRes5 = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        leaveTypeId: clType.id,
        fromDate: `${currentYear}-11-10`,
        toDate: `${currentYear}-11-12`,
        reason: 'Duplicate dates'
      })
    });
    assert(applyRes5.status === 409, '5. Duplicate active leave rejected with 409');

    // Test 6: Employee sees only own leave
    const listRes = await fetch(`${baseUrl}/leaves`, { headers: authHeaders });
    const listData = await listRes.json();
    assert(listRes.status === 200, '6. Employee retrieves leave history');
    assert(listData.data.records.every(r => r.employee_id === 1), 'All records belong strictly to authenticated employee');

    // Test 7: employee_id spoofing ignored
    const spoofRes = await fetch(`${baseUrl}/leaves`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: 999, // Attempted spoof
        employeeId: 999,
        leaveTypeId: slType.id,
        fromDate: `${currentYear}-11-20`,
        toDate: `${currentYear}-11-21`,
        reason: 'Testing spoof ignore'
      })
    });
    const spoofData = await spoofRes.json();
    assert(spoofRes.status === 201, '7. employee_id spoofing ignored; request succeeds');
    assert(spoofData.data.employee_id === 1, 'Spoofed ID ignored; assigned to authenticated employee ID 1');
    const spoofLeaveId = spoofData.data.id;

    // Test 8: Leave details
    const detailRes = await fetch(`${baseUrl}/leaves/${leaveId1}`, { headers: authHeaders });
    const detailData = await detailRes.json();
    assert(detailRes.status === 200, '8. Leave details retrieved successfully');
    assert(detailData.data.id === leaveId1 && detailData.data.leave_type_code === 'CL', 'Details match leave record');

    // Test 9: Eligible cancellation
    const cancelRes = await fetch(`${baseUrl}/leaves/${leaveId1}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    const cancelData = await cancelRes.json();
    assert(cancelRes.status === 200, '9. Eligible pending leave cancelled successfully');
    assert(cancelData.data.status === 'cancelled', 'Status updated to cancelled');

    // Verify balance refunded
    const balRes2 = await fetch(`${baseUrl}/leaves/balance?year=${currentYear}`, { headers: authHeaders });
    const balData2 = await balRes2.json();
    const clBalRestored = balData2.data.balances.find(b => b.leave_type_code === 'CL');
    assert(parseFloat(clBalRestored.pending_days) === 0.0 && parseFloat(clBalRestored.remaining_days) === 12.0, 'Balance refunded: pending back to 0 and remaining back to 12');

    // Test 10: Invalid cancellation rejected (already cancelled)
    const reCancelRes = await fetch(`${baseUrl}/leaves/${leaveId1}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(reCancelRes.status === 400, '10. Cancelling already cancelled leave rejected with 400');

    // -------------------------------------------------------------
    // HALF-DAY TESTS (11 - 15)
    // -------------------------------------------------------------
    console.log('\n--- HALF-DAY TESTS (11 - 15) ---');

    // Test 11: Valid first-half request
    const hdRes1 = await fetch(`${baseUrl}/half-days`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestDate: `${currentYear}-11-25`,
        session: 'first_half',
        reason: 'Morning doctor appointment'
      })
    });
    const hdData1 = await hdRes1.json();
    assert(hdRes1.status === 201, '11. Valid first-half request submitted (status 201)');
    assert(hdData1.data.session === 'first_half' && hdData1.data.status === 'pending', 'Session is first_half and status is pending');
    const hdId1 = hdData1.data.id;

    // Test 12: Valid second-half request
    const hdRes2 = await fetch(`${baseUrl}/half-days`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestDate: `${currentYear}-11-26`,
        session: 'second_half',
        reason: 'Afternoon family work'
      })
    });
    const hdData2 = await hdRes2.json();
    assert(hdRes2.status === 201, '12. Valid second-half request submitted (status 201)');
    assert(hdData2.data.session === 'second_half', 'Session is second_half');

    // Test 13: Duplicate active request rejected
    const hdRes3 = await fetch(`${baseUrl}/half-days`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        requestDate: `${currentYear}-11-25`,
        session: 'first_half',
        reason: 'Duplicate session request'
      })
    });
    assert(hdRes3.status === 409, '13. Duplicate active half-day request on same date & session rejected with 409');

    // Test 14: employee_id spoofing ignored
    const hdRes4 = await fetch(`${baseUrl}/half-days`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: 888,
        requestDate: `${currentYear}-11-27`,
        session: 'first_half',
        reason: 'Testing spoofing for half-day'
      })
    });
    const hdData4 = await hdRes4.json();
    assert(hdRes4.status === 201, '14. Half-day employee_id spoofing ignored; succeeds');
    assert(hdData4.data.employee_id === 1, 'Assigned to authenticated employee ID 1');

    // Test 15: Own records only
    const hdListRes = await fetch(`${baseUrl}/half-days`, { headers: authHeaders });
    const hdListData = await hdListRes.json();
    assert(hdListRes.status === 200, '15. Half-day history retrieved');
    assert(hdListData.data.records.every(r => r.employee_id === 1), 'All half-day records belong strictly to employee ID 1');

    // Cancel half-day
    const hdCancelRes = await fetch(`${baseUrl}/half-days/${hdId1}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(hdCancelRes.status === 200, 'Half-day request cancelled successfully');

    // -------------------------------------------------------------
    // PERMISSION TESTS (16 - 21)
    // -------------------------------------------------------------
    console.log('\n--- PERMISSION TESTS (16 - 21) ---');

    // Test 16: Valid permission
    const permRes1 = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        permissionDate: `${currentYear}-11-28`,
        fromTime: '10:00',
        toTime: '11:30',
        reason: 'Bank visit for official signature'
      })
    });
    const permData1 = await permRes1.json();
    assert(permRes1.status === 201, '16. Valid permission request submitted (status 201)');
    assert(permData1.data.status === 'pending', 'Status is pending');
    const permId1 = permData1.data.id;

    // Test 17: Invalid time range rejected (from_time >= to_time)
    const permRes2 = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        permissionDate: `${currentYear}-11-28`,
        fromTime: '14:00',
        toTime: '13:00',
        reason: 'Inverted time'
      })
    });
    assert(permRes2.status === 400, '17. Invalid time range (from_time >= to_time) rejected with 400');

    // Test 18: total_minutes calculated by server
    assert(permData1.data.total_minutes === 90, '18. total_minutes calculated server-side as 90 (10:00 to 11:30)');

    // Test 19: Overlapping permission rejected
    const permRes3 = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        permissionDate: `${currentYear}-11-28`,
        fromTime: '11:00', // Overlaps with 10:00-11:30
        toTime: '12:00',
        reason: 'Overlapping permission'
      })
    });
    assert(permRes3.status === 409, '19. Overlapping active permission rejected with 409');

    // Test 20: employee_id spoofing ignored
    const permRes4 = await fetch(`${baseUrl}/permissions`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        employee_id: 777,
        permissionDate: `${currentYear}-11-29`,
        fromTime: '15:00',
        toTime: '16:00',
        reason: 'Spoofing test'
      })
    });
    const permData4 = await permRes4.json();
    assert(permRes4.status === 201, '20. Permission employee_id spoofing ignored; succeeds');
    assert(permData4.data.employee_id === 1, 'Assigned to authenticated employee ID 1');

    // Test 21: Own records only
    const permListRes = await fetch(`${baseUrl}/permissions`, { headers: authHeaders });
    const permListData = await permListRes.json();
    assert(permListRes.status === 200, '21. Permission history retrieved');
    assert(permListData.data.records.every(r => r.employee_id === 1), 'All permission records belong strictly to employee ID 1');

    // Cancel permission
    const permCancelRes = await fetch(`${baseUrl}/permissions/${permId1}/cancel`, {
      method: 'PATCH',
      headers: authHeaders
    });
    assert(permCancelRes.status === 200, 'Permission request cancelled successfully');

    // -------------------------------------------------------------
    // REGRESSION TESTS (22 - 28)
    // -------------------------------------------------------------
    console.log('\n--- REGRESSION TESTS (22 - 28) ---');

    // Test 22: Health endpoint
    const hRes = await fetch(`${baseUrl}/health`);
    const hData = await hRes.json();
    assert(hRes.status === 200 && hData.data.database === 'connected', '22. GET /api/v1/health operational');

    // Test 23: Login
    const reLoginRes = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'employee@example.com', password: 'password123' })
    });
    assert(reLoginRes.status === 200, '23. POST /api/v1/auth/login operational');

    // Test 24: Profile
    const meRes = await fetch(`${baseUrl}/employees/me`, { headers: authHeaders });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.data.employee.email === 'employee@example.com', '24. GET /api/v1/employees/me operational');

    // Test 25: Attendance Check-In (Clean today's record first if already exists)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    await pool.query('DELETE FROM attendance WHERE employee_id = 1 AND attendance_date = ?', [todayStr]);

    const checkInRes = await fetch(`${baseUrl}/attendance/check-in`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 5.0
      })
    });
    const checkInData = await checkInRes.json();
    assert(checkInRes.status === 201 && checkInData.data.attendance !== undefined, '25. POST /api/v1/attendance/check-in operational');

    // Test 26: Attendance Check-Out
    const checkOutRes = await fetch(`${baseUrl}/attendance/check-out`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        latitude: 18.517222,
        longitude: 73.808722,
        accuracy: 5.0
      })
    });
    const checkOutData = await checkOutRes.json();
    assert(checkOutRes.status === 200 && checkOutData.data.attendance.check_out_time !== null, '26. POST /api/v1/attendance/check-out operational');

    // Test 27: Attendance History
    const attHistRes = await fetch(`${baseUrl}/attendance/history`, { headers: authHeaders });
    const attHistData = await attHistRes.json();
    assert(attHistRes.status === 200 && Array.isArray(attHistData.data.records), '27. GET /api/v1/attendance/history operational');

    // Test 28: Attendance Summary
    const attSumRes = await fetch(`${baseUrl}/attendance/summary`, { headers: authHeaders });
    const attSumData = await attSumRes.json();
    assert(attSumRes.status === 200 && attSumData.data.summary !== undefined, '28. GET /api/v1/attendance/summary operational');

  } finally {
    server.close();
  }

  console.log(`\n================================================================`);
  console.log(`   ALL ${passed} of ${total} PHASE 5 & REGRESSION TESTS PASSED!`);
  console.log(`================================================================`);
}

if (require.main === module) {
  runPhase5TestSuite()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test execution failed:', err);
      process.exit(1);
    });
}

module.exports = { runPhase5TestSuite };
