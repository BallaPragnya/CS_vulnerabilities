# CampusConnect – University Student Portal

A university student portal web application built for a **Web Server Security** academic assignment. CampusConnect demonstrates common web vulnerabilities and their mitigations across five independent modules.

---

## Technology Stack

| Layer    | Technology                     |
|----------|--------------------------------|
| Frontend | HTML, CSS, Vanilla JavaScript  |
| Backend  | Node.js + Express.js           |
| Database | SQLite (via `better-sqlite3`)  |
| Auth     | Server-side sessions (`express-session`) |

---

## Project Structure

```
CampusConnect/
  frontend/
    index.html          ← Homepage / landing page
    login.html          ← Login page
    dashboard.html      ← User dashboard
    directory.html      ← Student directory module
    diagnostics.html    ← Server diagnostics module
    search.html         ← Search module
    settings.html       ← User settings module
    css/
      style.css         ← Global design system
    js/
      common.js         ← Shared utilities (auth check, sidebar, API fetch)
      login.js          ← Login form handler
      dashboard.js      ← Dashboard logic
      directory.js      ← Directory table loader
      diagnostics.js    ← Status + audit log loader
      search.js         ← Search form handler
      settings.js       ← Profile viewer and editor

  backend/
    server.js           ← Express entry point
    database.js         ← SQLite setup and seed data
    routes/
      auth.js           ← Login / logout / session endpoints
      directory.js      ← Student directory API
      diagnostics.js    ← Server status and audit log API
      search.js         ← Student search API
      settings.js       ← Profile read and update API
    middleware/
      authMiddleware.js ← Session auth guard

  database/
    campusconnect.db    ← Auto-created SQLite database

  README.md
  package.json
```

---

## How to Run

### 1. Install dependencies

```bash
cd CampusConnect
npm install
```

### 2. Start the server

```bash
npm start
```

### 3. Open in your browser

```
http://localhost:3000
```

The server starts on **port 3000**. The database is auto-created on first run.

---

## Login Credentials

| Role    | Username  | Password     | Access Level                     |
|---------|-----------|--------------|----------------------------------|
| Admin   | `admin`   | `admin123`   | Full access to all modules       |
| Teacher | `teacher` | `teacher123` | View and manage student records  |
| Student | `alice`   | `alice123`   | Limited read-only access         |
| Student | `bob`     | `bob123`     | Limited read-only access         |
| Student | `charlie` | `charlie123` | Limited read-only access         |

---

## API Endpoints

| Method | Endpoint                        | Description                     | Auth Required |
|--------|---------------------------------|---------------------------------|---------------|
| POST   | `/api/auth/login`               | Log in with credentials         | No            |
| POST   | `/api/auth/logout`              | Destroy session                 | No            |
| GET    | `/api/auth/me`                  | Get current session user        | Yes           |
| GET    | `/api/directory`                | List all students               | Yes           |
| GET    | `/api/directory/:id`            | Get one student by ID           | Yes           |
| GET    | `/api/search?q=term`            | Search students                 | Yes           |
| GET    | `/api/diagnostics/status`       | Server health info              | Yes           |
| GET    | `/api/diagnostics/logs`         | Audit log entries               | Yes           |
| GET    | `/api/settings/profile`         | Get current user profile        | Yes           |
| POST   | `/api/settings/update-profile`  | Update name and email           | Yes           |

---

## Modules

### 1. Student Directory (`/directory.html`)
Displays a table of all enrolled students with ID, name, email, department, year, and GPA.

### 2. Search (`/search.html`)
Live search for students by name, email, or department.

### 3. Server Diagnostics (`/diagnostics.html`)
Shows real-time server status (uptime, memory, Node version) and the full audit log.

### 4. Settings (`/settings.html`)
Allows users to view and edit their display name and email address.

### 5. Dashboard (`/dashboard.html`)
Overview with stat cards and recent audit log activity.

---

## Notes

- Passwords are stored in **plain text** intentionally for the security lab demonstration.  
  In production, always hash passwords with `bcrypt` or similar.
- The SQLite database file (`database/campusconnect.db`) is auto-created on first run.
- Sessions expire after **2 hours** of inactivity.
