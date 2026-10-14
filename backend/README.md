# Attendance Backend Service

Node.js & Express REST API for Employee Attendance, Leaves, Half-Day, Permissions, and Notifications.

> [!IMPORTANT]
> **Database Environment**: Local development runs on MySQL via XAMPP (`localhost:3306`). For production deployments, use a dedicated hosted/managed MySQL or MariaDB instance (e.g., AWS RDS, GCP Cloud SQL, or DigitalOcean Managed Databases). Never use XAMPP in production environments.

---

## Database Architecture (`attendanceApp`)

Cumulative Tables:
1. `system_settings` (Phases 1, 3, 4: Office GPS coordinates `18.517222, 73.808722`, 10m radius, `Asia/Kolkata` timezone, `09:00:00` start time, `18:00:00` end time)
2. `employees` (Phase 2: Authentication, JWT, employee profiles)
3. `attendance` (Phases 3-4: GPS check-in/out, Haversine validation, working duration, late/early flags)
4. `leave_types` (Phase 5: CL, SL, EL)
5. `employee_leave_balances` (Phase 5: Annual balances per employee)
6. `leave_requests` (Phase 5: Multi-day leaves with status and balance deduction)
7. `half_day_requests` (Phase 5: First-half / Second-half shift absences)
8. `permission_requests` (Phase 5: Short-duration working-hour permissions)
9. `notifications` (Phase 6: In-app notification inbox, event records, read/unread states, indexes)

---

## Phase 6 Implementation

### 1. Notification Architecture
A clean service/provider abstraction is implemented in `src/services/notificationService.js`:
```
Controller / Business Logic
         ↓
NotificationService (Database Persistence & Event Dispatcher)
         ↓
NotificationProvider (Pluggable Push Notification Abstraction)
         ↓
Expo Push / Firebase Cloud Messaging (When configured in production)
```
- **Local Fallback**: Database notifications function 100% reliably in development even without push credentials.
- **Push Decoupling**: If push delivery fails or credentials are not yet configured, the system logs a safe warning without interrupting user operations or failing requests.
- **Event Notifications**: Automatically dispatched upon:
  - Check-in (`attendance`)
  - Check-out (`attendance`)
  - Leave applied & cancelled (`leave`)
  - Half-day applied & cancelled (`half_day`)
  - Permission applied & cancelled (`permission`)

### 2. Notification APIs

All notification endpoints require Bearer JWT authentication and enforce strict employee isolation.

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/v1/notifications` | Paginated notifications for authenticated employee (`page`, `limit`, `is_read`, `type`) |
| `GET` | `/api/v1/notifications/unread-count` | Unread notifications count |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark single notification as read (strictly owned by caller) |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all notifications for authenticated employee as read |

### 3. Security Hardening & Abuse Protection

- **JWT Security**: Signed with `JWT_SECRET`, configurable expiration (`JWT_EXPIRES_IN=7d`), strict Bearer header parsing. Invalid, expired, and malformed tokens return safe 401 responses.
- **Rate Limiting**: Sliding window rate limiters (`src/middlewares/rateLimiter.js`):
  - Auth Limiter: 15 requests per 15 minutes on sensitive endpoints (`/auth/login`) to mitigate brute force attacks.
  - General API Limiter: 500 requests per 15 minutes per IP.
- **Request Body Limits**: Express JSON and URL-encoded body size capped at `100kb` (`BODY_LIMIT=100kb`) to protect against payload denial-of-service. Oversized requests return HTTP 413.
- **Security Headers (Helmet)**: Enabled across all endpoints: `X-Content-Type-Options: nosniff`, frameguard, and referrer policy.
- **CORS Protection**: Environment-controlled `CORS_ORIGIN` (defaults to `*` in development for mobile emulator support; restricted in production).
- **Data Exposure Prevention**: `password_hash`, database passwords, internal stack traces, and SQL queries are never exposed in API responses or logs.
- **Production Error Masking**: `errorHandler.js` shields database errors and returns safe generic messages in production while exposing debug details only in development.

### 4. GPS & Mock Location Security

- **Server-Side Authority**: Distance calculation uses server-side Haversine formula against database coordinates (`18.517222, 73.808722`). Client-calculated distance or timestamps are never accepted.
- **Mock-Location Detection**: Evaluates `isMocked` and `mocked` indicators reported by Expo Location / OS provider. Mocked requests are immediately rejected with HTTP 403: `"Mock location detected. Attendance cannot be recorded."`
- **GPS Accuracy Validation**: Enforces maximum allowed inaccuracy (`MAX_ALLOWED_ACCURACY_METERS=50`). Imprecise readings are rejected with HTTP 400.
- **Anti-Spoofing Limitation Notice**: Client-level mock location detection inspects OS-level test flags provided by Expo Location. Advanced hardware-level GPS spoofing or rooted kernel hooks cannot be detected client-side alone; server-side geofencing and timestamping remain primary security boundaries.

---

## Environment Variables (`.env`)

| Variable | Default (Local) | Description |
|---|---|---|
| `PORT` | `5000` | HTTP API listening port |
| `NODE_ENV` | `development` | Environment mode (`development` / `production`) |
| `DB_HOST` | `localhost` | MySQL host address |
| `DB_PORT` | `3306` | MySQL port (3306 for XAMPP default) |
| `DB_USER` | `root` | Database username |
| `DB_PASSWORD` | `""` | Database password |
| `DB_NAME` | `attendanceApp` | MySQL database name |
| `JWT_SECRET` | `attendance_dev_jwt_secret_key_2026` | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | `7d` | Token validity period |
| `CORS_ORIGIN` | `*` | Allowed CORS origins |
| `BODY_LIMIT` | `100kb` | Maximum Express request body size |
| `AUTH_RATE_LIMIT_WINDOW_MS` | `900000` | Auth rate limit window (15 mins) |
| `AUTH_RATE_LIMIT_MAX` | `15` | Max auth attempts per window |
| `MAX_ALLOWED_ACCURACY_METERS` | `50` | Maximum acceptable GPS accuracy radius |
| `EXPO_PUSH_ACCESS_TOKEN` | `""` | Optional Expo push token for remote push |
| `FIREBASE_SERVICE_ACCOUNT_KEY`| `""` | Optional Firebase credentials for remote push |

---

## Testing Commands

```bash
# Phase 6 Notifications, Security & Full Regression Test Suite (56 tests)
npm run test:phase6

# Phase 5 Leave, Half-Day & Permission Test Suite (49 tests)
npm run test:phase5

# Phase 4 Shift Configuration & Regression Test Suite (58 tests)
npm run test:regression

# Database Seeders
npm run seed:employee
npm run seed:leave
```
