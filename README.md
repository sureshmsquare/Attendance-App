# Employee Attendance Mobile Application

Complete architecture and implementation for an Employee Attendance Mobile Application with geofenced GPS check-in/out, leave management, in-app notifications, and security hardening.

> [!IMPORTANT]
> **Production vs. Local Database Notice**:
> Local development runs on MySQL via XAMPP (`localhost:3306`). For production deployments, use a dedicated hosted/managed MySQL or MariaDB instance (e.g., AWS RDS, GCP Cloud SQL, or DigitalOcean Managed Databases). Never use XAMPP in production environments.

---

## Project Structure

```
attendanceApp/
├── backend/       # Node.js + Express.js Common REST API & MySQL Database
├── mobileApp/     # React Native (Expo) Mobile Application
├── admin/         # Reserved for Future Admin Web Portal (Untouched)
├── .gitignore     # Git ignore rules for repository
└── README.md      # Project overview and setup instructions
```

---

## Project Status & Phases Overview

| Phase | Description | Status |
|---|---|---|
| **Phase 1** | Project Setup & Architecture (Health check, MySQL connectivity, schema) | **COMPLETED** |
| **Phase 2** | Authentication + Employee Profile (JWT, password hashing, profile APIs) | **COMPLETED** |
| **Phase 3** | GPS Attendance (Haversine validation, 10m office radius `18.517222, 73.808722`) | **COMPLETED** |
| **Phase 4** | Attendance History + Reports (Calendar, monthly breakdown, late/early flags) | **COMPLETED** |
| **Phase 5** | Leave + Half-Day + Permission (Balances, requests, conflict prevention, cancellation) | **COMPLETED** |
| **Phase 6** | Notifications + Security + Final Testing (Inbox, rate limits, mock GPS rejection, regression) | **COMPLETED** |

---

## System Architecture

```
React Native Mobile App (mobileApp/)
        ↓ (HTTP / REST API with JWT)
Node.js + Express.js Backend (backend/)
        ↓ (Connection Pool)
MySQL Database (attendanceApp)
```

The backend is structured to serve both the `mobileApp/` and the future `admin/` portal.

---

## Phase 6 Implementation Highlights

### 1. In-App Notifications Architecture
- Pluggable provider abstraction (`src/services/notificationService.js`) decoupled from third-party vendor code.
- MySQL `notifications` table storing `employee_id`, `title`, `message`, `type`, `reference_id`, `is_read`, timestamps.
- Indexed by `employee_id`, `is_read`, `created_at`, and `type`.
- Automatically dispatches employee alerts on:
  - Check-in & Check-out
  - Leave applied & cancelled
  - Half-day applied & cancelled
  - Permission applied & cancelled
- Dedicated mobile screen (`NotificationScreen.js`) with read/unread visual states, filter tabs, unread badge, and mark-read actions.

### 2. Security Hardening
- **JWT Protection**: Strict Bearer token parsing, environment secret configuration, standard expiration (`7d`), and safe 401 handling for missing, invalid, or expired tokens.
- **API Rate Limiting**: In-memory sliding window rate limiters:
  - `authLimiter`: 15 requests per 15 minutes on `/auth/login` to prevent brute-force attacks.
  - `generalLimiter`: 500 requests per 15 minutes per IP.
- **Request Body Limits**: Capped at `100kb` to protect against payload denial-of-service (HTTP 413 handling).
- **Security Headers**: Integrated Helmet for `X-Content-Type-Options: nosniff`, frame protection, and safe defaults.
- **CORS Configuration**: Configurable via `CORS_ORIGIN` in environment (defaults to `*` in development for mobile emulator support).
- **Sensitive Data Scrubbing**: Passwords, password hashes, JWT tokens, and internal database stack traces are never logged or returned in responses.
- **Safe Error Handler**: Production errors mask internal SQL, credentials, and filesystem paths.

### 3. GPS & Anti-Spoofing Security
- **Authoritative Server**: Coordinates and distance are validated strictly server-side using the Haversine formula against confirmed office coordinates (`18.517222, 73.808722`) within the 10-meter radius.
- **Mock Location Detection**: Inspects client location metadata (`isMocked` / `mocked`) and rejects mocked coordinates with HTTP 403: `"Mock location detected. Attendance cannot be recorded."`
- **Accuracy Threshold**: GPS readings with accuracy radius > 50 meters are rejected with HTTP 400.
- **Anti-Spoofing Limitations**: Mock detection relies on OS-level provider flags exposed via Expo Location. While effective against standard fake-location apps, sophisticated kernel-level hooks or hardware spoofers cannot be detected client-side alone; server-side geofencing and timestamps remain the primary authority.

---

## Automated Test Suites

All tests run against the local MySQL database without destroying production-like data:

```bash
cd backend

# Phase 6 Full Test Suite (56 tests covering Notifications, Security, GPS, and Regressions)
npm run test:phase6

# Phase 5 Test Suite (49 tests covering Leaves, Half-Days, Permissions, and Regressions)
npm run test:phase5

# Phase 4 Shift Configuration & Regression Test Suite (58 tests)
npm run test:regression
```

### Mobile Bundle Verification

```bash
cd mobileApp

# Export Web Bundle
npx expo export --platform web

# Export Android Hermes Bytecode Bundle
npx expo export --platform android
```

---

## Test Employee Credentials

- **Email**: `employee@example.com`
- **Password**: `password123`
- **Employee Code**: `EMP001`
- **Office Location**: Latitude `18.517222`, Longitude `73.808722` (10m radius)
- **Timezone**: Indian Standard Time (`Asia/Kolkata`)
