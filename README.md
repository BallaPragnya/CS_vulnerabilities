# CampusConnect – Web Server Security Assignment

> **Academic Project** | Web Server Security | IIIT Allahabad

A simple university student portal demonstrating **five classic web security vulnerabilities** side-by-side with their mitigations — for educational purposes only.

Built with plain **HTML · CSS · Vanilla JavaScript · Node.js · Express.js · SQLite (sql.js)** — no React, no TypeScript, no Docker.

---

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/BallaPragnya/CS_vulnerabilities.git
cd CS_vulnerabilities/CampusConnect

# 2. Install dependencies (only needed once)
npm install

# 3. Start the server
npm start
```

Open your browser and go to → **http://localhost:3000**

The SQLite database (`database/campusconnect.db`) is **created automatically** with seed data on the first run.

---

## 🔑 Demo Login Credentials

| Username  | Password   | Role    |
|-----------|------------|---------|
| alice     | alice123   | student |
| admin     | admin123   | admin   |
| teacher   | teacher123 | teacher |
| bob       | bob123     | student |
| charlie   | charlie123 | student |

---

## 🛠️ Technology Stack

| Layer      | Technology                        |
|------------|-----------------------------------|
| Frontend   | HTML5, CSS3, Vanilla JavaScript   |
| Backend    | Node.js, Express.js               |
| Database   | SQLite via sql.js (pure JS)       |
| Session    | express-session                   |
| Passwords  | bcryptjs                          |

No native C++ compilation required. Works on **Windows, Linux, and macOS**.

---

## 📁 Project Structure

```
CampusConnect/
├── backend/
│   ├── server.js                ← Express app entry point
│   ├── database.js              ← SQLite setup, schema & seed data
│   ├── middleware/
│   │   └── authMiddleware.js    ← Session authentication guard
│   └── routes/
│       ├── auth.js              ← Login, register, logout, session
│       ├── sqli-demo.js         ← Module 1: SQLi Auth Bypass
│       ├── directory.js         ← Module 2: SQLi UNION Attack
│       ├── diagnostics.js       ← Module 3: Command Injection
│       ├── search.js            ← Module 4: Reflected XSS
│       ├── settings.js          ← Module 5: CSRF
│       ├── announcements.js     ← Announcement data endpoints
│       └── comments.js          ← Dashboard comment endpoints
├── frontend/
│   ├── index.html               ← Landing page
│   ├── login.html               ← Module 1: SQLi Auth Bypass
│   ├── dashboard.html           ← Central hub linking all 5 modules
│   ├── directory.html           ← Module 2: SQLi UNION Attack
│   ├── diagnostics.html         ← Module 3: Command Injection
│   ├── search.html              ← Module 4: Reflected XSS
│   ├── settings.html            ← Module 5: CSRF
│   ├── csrf-attacker.html       ← Standalone CSRF attacker demo page
│   ├── register.html            ← New account registration
│   ├── sqli-demo.html           ← Extended SQLi Auth Bypass lab
│   ├── css/
│   │   └── style.css            ← Global styles (blue & white theme)
│   └── js/
│       ├── common.js            ← Shared utilities, nav, session check
│       ├── dashboard.js
│       ├── login.js
│       ├── directory.js
│       ├── diagnostics.js
│       ├── search.js
│       └── settings.js
├── database/
│   └── README.md                ← Explains that .db is auto-generated
├── package.json
├── .gitignore
└── README.md
```

---

## 🔒 Security Modules

Each module has two tabs: **Normal Mode** (application functions as intended) and **Security Lab** (vulnerable vs secured demonstration).

---

### Module 1 — SQL Injection: Authentication Bypass

| Property   | Detail |
|------------|--------|
| **Page**   | `login.html` → "⚠️ Security Lab" tab |
| **Variant**| In-band SQLi – Boolean / Always-True |
| **Endpoint**| `POST /api/sqli-demo/login-vuln` (vulnerable) · `POST /api/sqli-demo/login-safe` (secure) |

**How the vulnerability works:**

User input is embedded directly into a SQL string using string concatenation:

```js
// ⚠️ VULNERABLE
const sql = `SELECT * FROM sqli_demo_users
             WHERE username = '${username}'
             AND password = '${password}'`;
```

**Attack payload:** Username = `' OR '1'='1' --`

The injected `OR '1'='1'` makes the WHERE clause always true, returning all rows. The first row is treated as the authenticated user → bypass!

**How to test:**
1. Open `http://localhost:3000/login.html`
2. Click the **⚠️ Security Lab** tab
3. Select **Vulnerable Mode**
4. Enter username: `' OR '1'='1' --` and any password
5. Click **Test Login** → observe bypass
6. Switch to **Secured Mode** → same payload is rejected

**Fix — Parameterised queries:**

```js
// ✅ SECURE
const user = db.prepare(
  'SELECT * FROM sqli_demo_users WHERE username = ? AND password = ?'
).get(username, password);
```

---

### Module 2 — SQL Injection: UNION-based Data Extraction

| Property   | Detail |
|------------|--------|
| **Page**   | `directory.html` → "💉 SQL Injection Lab" tab |
| **Variant**| In-band SQLi – UNION-based |
| **Endpoint**| `GET /api/directory/search-vuln` (vulnerable) · `GET /api/directory/search-safe` (secure) |

**How the vulnerability works:**

The search input is inserted into a `LIKE` clause without sanitisation:

```js
// ⚠️ VULNERABLE
const sql = `SELECT student_id, full_name, email, department, year, gpa
             FROM students WHERE full_name LIKE '%${name}%'`;
```

**Attack payload:**

```sql
' UNION SELECT username, password, role, email, 1, 1 FROM users --
```

The `UNION` appends a second result set that dumps usernames, hashed passwords, and roles from the `users` table into the student results.

**How to test:**
1. Open `http://localhost:3000/directory.html`
2. Click the **💉 SQL Injection Lab** tab
3. Select **Vulnerable Mode**
4. Paste the UNION payload above and click **Search**
5. Observe `users` table data appearing in results
6. Switch to **Secured Mode** → payload is treated as a literal string

**Fix — Parameterised LIKE query:**

```js
// ✅ SECURE
db.prepare(
  'SELECT student_id, full_name, email, department, year, gpa FROM students WHERE full_name LIKE ?'
).all(`%${name}%`);
```

---

### Module 3 — OS Command Injection: In-Band

| Property   | Detail |
|------------|--------|
| **Page**   | `diagnostics.html` → "💉 Command Injection Lab" tab |
| **Variant**| In-band Command Injection via shell metacharacters |
| **Endpoint**| `POST /api/diagnostics/ping-vuln` (vulnerable) · `POST /api/diagnostics/ping-safe` (secure) |

**How the vulnerability works:**

User input is embedded directly into a shell command string passed to `exec()`:

```js
// ⚠️ VULNERABLE
exec(`ping -n 3 ${host}`, callback);
```

**Attack payload (Windows):** `127.0.0.1 & whoami`

The `&` is a Windows shell command separator. After `ping` runs, `whoami` also executes and its output is returned in the response.

**Safety guardrails:** Destructive commands (`rm`, `del`, `format`, `shutdown`, `rmdir`) are blocked by a denylist even in vulnerable mode. This is an *academic demonstration* only.

**How to test:**
1. Open `http://localhost:3000/diagnostics.html`
2. Click the **💉 Command Injection Lab** tab
3. Select **Vulnerable Mode**
4. Enter: `127.0.0.1 & whoami`
5. Click **Run Ping** → observe `whoami` output alongside ping
6. Switch to **Secured Mode** → payload is rejected by input validation

**Fix — `execFile()` with argument array (no shell spawned):**

```js
// ✅ SECURE
const safePattern = /^[a-zA-Z0-9.\-]{1,253}$/;
if (!safePattern.test(host)) return res.status(400).json({ error: 'Invalid hostname.' });
execFile('ping', ['-n', '3', host], callback);
```

---

### Module 4 — Reflected XSS (Cross-Site Scripting)

| Property   | Detail |
|------------|--------|
| **Page**   | `search.html` → "💉 XSS Lab" tab |
| **Variant**| Reflected XSS – stored term reflected into innerHTML |
| **Endpoint**| `GET /api/search/announcements-vuln` (vulnerable) · `GET /api/search/announcements-safe` (secure) |

**How the vulnerability works:**

The search term is reflected back into the page using `innerHTML`:

```js
// ⚠️ VULNERABLE
resultContainer.innerHTML = `<p>Results for: <b>${searchTerm}</b></p>`;
```

The browser parses the value as HTML and executes any embedded scripts.

**Attack payload:** `<img src=x onerror=alert('XSS Demo!')>`

**How to test:**
1. Open `http://localhost:3000/search.html`
2. Click the **💉 XSS Lab** tab
3. Select **Vulnerable Mode**
4. Enter: `<img src=x onerror=alert('XSS Demo!')>`
5. Click **Search** → browser fires the alert
6. Switch to **Secured Mode** → payload is rendered as plain text

**Fix — `textContent` and `DOMPurify`-style escaping:**

```js
// ✅ SECURE
labelEl.textContent = searchTerm;   // treated as plain text, never parsed as HTML
```

---

### Module 5 — CSRF: Cross-Site Request Forgery

| Property   | Detail |
|------------|--------|
| **Page**   | `settings.html` → "💉 CSRF Lab" tab + `csrf-attacker.html` |
| **Variant**| CSRF – state-changing POST without origin verification |
| **Endpoint**| `POST /api/settings/email-vuln` (vulnerable) · `POST /api/settings/email-safe` (secure) |

**How the vulnerability works:**

The email-update endpoint accepts any POST request that carries a valid session cookie, with no check that the request originated from the application itself:

```html
<!-- Attacker's page on evil.com -->
<form action="http://localhost:3000/api/settings/email-vuln" method="POST">
  <input name="email" value="hacker@evil.com" />
</form>
<script>document.forms[0].submit();</script>
```

The victim visits the attacker's page while logged in → their email is silently changed.

**How to test:**
1. Log in as `alice` / `alice123`
2. Open `http://localhost:3000/csrf-attacker.html` in the same browser
3. Click **Launch CSRF Attack** → alice's email is changed without her consent
4. Open `http://localhost:3000/settings.html` → "💉 CSRF Lab" tab, **Secured Mode**
5. The same form is now rejected: CSRF token mismatch

**Fix — Synchronizer Token Pattern:**

```js
// Server: generate token, store in session
req.session.csrfToken = crypto.randomBytes(32).toString('hex');

// Server: validate on every state-changing request
if (!csrf_token || csrf_token !== req.session.csrfToken) {
  return res.status(403).json({ success: false, message: 'CSRF token mismatch!' });
}
```

---

## 🧪 Testing All Modules — Quick Reference

| Module | URL | Lab Tab | Vulnerable Payload |
|--------|-----|---------|-------------------|
| 1 – SQLi Auth Bypass | `/login.html` | ⚠️ Security Lab | `' OR '1'='1' --` |
| 2 – SQLi UNION | `/directory.html` | 💉 SQL Injection Lab | `' UNION SELECT username,password,role,email,1,1 FROM users --` |
| 3 – Cmd Injection | `/diagnostics.html` | 💉 Command Injection Lab | `127.0.0.1 & whoami` |
| 4 – Reflected XSS | `/search.html` | 💉 XSS Lab | `<img src=x onerror=alert('XSS!')>` |
| 5 – CSRF | `/csrf-attacker.html` → `/settings.html` | 💉 CSRF Lab | Auto-submit attacker form |

---

## ⚠️ Safety Notes

- All vulnerability demonstrations are **restricted to localhost only**.
- Vulnerable endpoints use **isolated dummy data** (not real user accounts).
- Destructive shell commands (`rm`, `del`, `format`, `shutdown`) are **blocked** in the command injection demo.
- **Never deploy this application publicly.**
- **Never use this code in a production environment.**

---

## 📦 Dependencies

| Package         | Version | Purpose                           |
|-----------------|---------|-----------------------------------|
| express         | ^4.18.3 | Web framework                     |
| express-session | ^1.18.0 | Server-side session management    |
| bcryptjs        | ^3.0.3  | Password hashing                  |
| cors            | ^2.8.5  | Cross-Origin Resource Sharing     |
| sql.js          | ^1.12.0 | SQLite (pure JS, no native build) |

---

## 👥 Team

| # | Name | Roll Number |
|---|------|-------------|
| 1 | _(Team Member 1)_ | _(Roll No.)_ |
| 2 | _(Team Member 2)_ | _(Roll No.)_ |
| 3 | _(Team Member 3)_ | _(Roll No.)_ |
| 4 | _(Team Member 4)_ | _(Roll No.)_ |
| 5 | _(Team Member 5)_ | _(Roll No.)_ |

---

## 📋 Academic Disclaimer

> This project is submitted as part of the **Web Server Security** course assignment at **IIIT Allahabad**.
> 
> All vulnerability demonstrations are implemented **strictly for educational purposes** in a **controlled, local environment**.
> The code intentionally contains insecure patterns to illustrate how attacks work and how they are mitigated.
> 
> **This application must never be deployed to a public server.**
> The authors do not endorse or encourage any malicious use of the techniques demonstrated here.
