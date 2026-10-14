# Attendance Mobile Application

React Native + Expo Mobile Application for Employee Attendance, Leaves, Half-Days, Permissions, and Notifications.

## Features

- **Phase 1**: Architecture & UI Setup
- **Phase 2**: JWT Authentication & Employee Profile
- **Phase 3**: GPS Geofencing (10-meter validation) Check-In / Check-Out
- **Phase 4**: Attendance History, Monthly Calendar Reports & Working Hours Summaries
- **Phase 5**: Leave, Half-Day & Short Permission Management
- **Phase 6**: Notifications Inbox, Unread Counter Badge & GPS Mock-Location Anti-Spoofing Detection

---

## Phase 6 Screens & Components

### 1. NotificationScreen (`src/screens/NotificationScreen.js`)
- **Notification Inbox**: Displays list of activity notifications (attendance check-in/out, leave applications/cancellations, half-day, and permission events).
- **Interactive States**: Read and unread distinction with visual dots and tinting.
- **Unread Badge Counter**: Real-time unread count indicator in header and bottom navigation tab.
- **Mark As Read**: Tap individual notification or dedicated check action to mark as read.
- **Mark All As Read**: Header action to mark all notifications as read in a single API call.
- **Filter Chips**: Filter by "All", "Unread", "Attendance", or "Requests".
- **Pull-To-Refresh**: Native `RefreshControl` support.

### 2. Location & Mock-Detection Security (`src/utils/location.js`)
- Uses `expo-location` with high accuracy.
- Detects mock location flags from Android/iOS location providers (`location.mocked` or `location.isMocked`).
- Passes `isMocked` attribute to server during `checkIn` and `checkOut` for server-side authorization and anti-spoofing rejection.

---

## API Services Integration

- **`src/services/notificationService.js`**: `getNotifications`, `getUnreadCount`, `markAsRead`, `markAllAsRead`
- **`src/services/leaveService.js`**: `getLeaveTypes`, `getLeaveBalances`, `applyLeave`, `getLeaveHistory`, `cancelLeave`
- **`src/services/halfDayService.js`**: `applyHalfDay`, `getHalfDayHistory`, `cancelHalfDay`
- **`src/services/permissionService.js`**: `applyPermission`, `getPermissionHistory`, `cancelPermission`
- **`src/services/attendanceService.js`**: `checkIn`, `checkOut`, `getTodayAttendance`, `getHistory`, `getMonthly`, `getSummary`

---

## Navigation (`src/navigation/AppNavigator.js`)

Bottom navigation bar provides smooth switching between authenticated sections:
- 📍 **Today**: GPS check-in/out dashboard
- 📅 **History**: Monthly calendar & attendance report
- 🏖️ **Leave**: Leave balance & leave applications
- ⏱️ **Half-Day**: First-half & second-half absence requests
- 🎫 **Permission**: Short working-hour permissions
- 🔔 **Alerts**: In-app notifications inbox with dynamic unread badge
- 👤 **Profile**: Employee profile & details
- ⚡ **System**: Backend API health & configuration check

---

## Running & Exporting Mobile App

```bash
cd mobileApp
npm install

# Start development bundler:
npm start

# Run Android emulator / device:
npm run android

# Run Web in browser:
npm run web

# Export static production bundle for Web:
npx expo export --platform web

# Export production Hermes bytecode for Android:
npx expo export --platform android
```
