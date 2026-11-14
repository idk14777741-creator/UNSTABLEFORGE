# UNSTABLEFORGE

**Where Ideas Take Shape.**

Unstable Forge is a hackathon discovery, registration and ticketing platform designed for students across ALTA campuses.

The platform aims to simplify how students discover hackathons, register individually or as teams, manage their participation and access their event tickets. It also gives organizers a centralized space to publish hackathons, manage registrations and handle participant check-ins.

The first featured event planned for the platform is **C³ (C Cube) — Crescent Code Clash**.

## The Problem

Hackathon information, registrations and participant management can often be scattered across different platforms and communication channels.

Students may struggle to discover upcoming opportunities, understand registration requirements, form teams and keep track of their participation. Organizers, meanwhile, need a reliable way to manage registrations, monitor capacity and verify attendees.

Unstable Forge aims to bring these processes together in one platform.

## What the Platform Offers

### For Participants

- Discover upcoming and featured hackathons.
- Explore hackathon details, eligibility, rules, deadlines and schedules.
- Create an account and manage a personal profile.
- Register individually or create and join teams.
- View registration status and participation history.
- Access digital tickets with unique QR codes.

### For Organizers

- Create, edit and publish hackathon listings.
- Configure registration deadlines, capacity and team-size limits.
- Manage individual participants and registered teams.
- Search and filter registrations.
- Verify participant tickets through QR scanning.
- View registration and attendance statistics.

### For Platform Administrators

- Manage users and organizer access.
- Review and manage hackathon listings.
- Oversee registrations and platform activity.
- Feature selected hackathons on the discovery page.

## Key Features

- **Hackathon Discovery:** A dedicated space to explore hackathons and their details.
- **Individual & Team Registration:** Support for solo participants and collaborative teams.
- **Digital QR Tickets:** Unique tickets for registered participants.
- **Capacity Management:** Server-side registration validation to prevent overbooking.
- **QR Check-in:** Verify tickets and prevent duplicate check-ins.
- **Organizer Dashboard:** Centralized management of hackathons, registrations and attendees.
- **Role-Based Access:** Separate permissions for participants, organizers and administrators.

## Routes and Authentication (Day 8)

The current build is the Unstable Forge event site for C³, with a client-side history router and a bearer-token API.

### Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page for Unstable Forge and C³ |
| `/login` | Guests | Sign in with an existing account |
| `/signup` | Guests | Create a participant account |
| `/announcements` | Public | Searchable, filtered announcement archive |
| `/announcements/:slug` | Public | Announcement detail |
| `/admin` | Organizer / admin | Control room dashboard |
| `/admin/announcements` | Organizer / admin | Announcement management, including drafts |
| `/admin/announcements/new` | Organizer / admin | Create a dispatch |
| `/admin/announcements/:id/edit` | Organizer / admin | Edit an existing dispatch |
| `/unauthorized` | Signed-in non-organizers | Clear 403 state |
| Any other path | Public | Custom 404 page |

Navigation uses `history.pushState`, so page changes do not trigger a full reload. Refreshing any nested route is handled by the Vite development server and by the Express SPA fallback in production.

### Authentication Flow

- `POST /api/auth/signup` creates a **participant** account. It validates email and password, rejects duplicates with `409 EMAIL_TAKEN`, and never returns a token. Organizer access cannot be self-assigned.
- `POST /api/auth/login` verifies the scrypt password hash and returns an HMAC-signed bearer token, an expiry timestamp and the user record.
- `GET /api/auth/me` validates the stored token when the application starts.
- The token and user are stored in `localStorage` under `unstableforge.session.v1`. On load, the app checks the expiry locally and confirms the session with `/api/auth/me` before rendering protected content.
- A route guard waits while the session is being checked, redirects signed-out visitors to `/login?next=…`, and returns them to the requested destination after sign-in.
- Signed-in users are redirected away from `/login` and `/signup`.
- A `401` from any authenticated request clears the session and returns the user to login with an expired-session message. Logout clears the stored session immediately.
- Role checks on the client are only a navigation convenience. `requireOrganizer` on the Express API authorizes every privileged request, so a participant receives `403` even if they call an admin endpoint directly.

### Current Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite 6 |
| Styling | Custom CSS design system |
| Routing | Lightweight history router in `src/lib/router.jsx` |
| Backend | Node.js + Express |
| Database | SQLite via `better-sqlite3` |
| Authentication | HMAC-signed bearer tokens, scrypt password hashing |
| API tests | Node test script (`npm run test:api`) |

The PostgreSQL, Supabase, JWT/bcrypt, Vercel and Render stack in the product plan is not the current prototype implementation.

## Project Structure

The current application is organized around three layers:

- **Frontend:** `src/` — landing page, announcements, authentication screens, route guards and the organizer control room.
- **Backend:** `server/` — Express API, SQLite data access, token signing/verification and role middleware.
- **Database:** `server/data/unstable-forge.db` — the local SQLite database. It is generated locally and must not be committed.

## Running Locally

```bash
npm install
```

Create a `.env` file in the project root with at least:

```dotenv
AUTH_SECRET=replace-with-a-long-random-secret
ADMIN_EMAIL=your-organizer-email
ADMIN_PASSWORD=your-organizer-password
```

`AUTH_SECRET` must be at least 16 characters (32+ is recommended). The organizer account is seeded from `ADMIN_EMAIL` and `ADMIN_PASSWORD` on first start. Never commit `.env`.

Start the API and the Vite dev server in separate terminals:

```bash
npm run server   # http://localhost:4000
npm run dev      # http://localhost:5173, proxies /api to port 4000
```

For a production-style run:

```bash
npm run build
npm start        # Express serves dist/ and the API on port 4000
```

### Tests

With the API running:

```bash
npm run test:api
```

The suite covers public announcements, organizer CRUD, signup validation, duplicate accounts, participant login, role-based `403`s, draft visibility, admin filtering and invalid sessions. Day 8 finished with **58 passing checks**.

## What I Built and What I Understood

This project is an opportunity to apply full-stack development concepts to a practical problem.

Through building Unstable Forge, I aim to understand:

- How frontend and backend applications communicate through REST APIs.
- How authentication and role-based authorization work.
- How relational database schemas and relationships are designed.
- How individual and team registration workflows are handled.
- How backend validation protects registration capacity.
- How unique QR tickets can be generated and securely verified.
- How a full-stack application is tested and deployed.

Day 8 made the authentication architecture concrete: a centralized React auth context restores and validates a bearer session, route guards distinguish *checking*, *signed in* and *signed out*, and the backend remains the authority for organizer-only operations. Signup deliberately creates participants only; organizer access is seeded/assigned, not chosen in a form.

Manual browser checks covered valid and invalid login, signup and duplicate handling, refresh persistence, protected redirects and return paths, participant vs organizer access, logout, expired sessions, direct nested-route loads, mobile layouts and the existing landing page. The full API suite passes 58/58.

Known limitation: the existing API is bearer-token based, so the session is kept in `localStorage`. That follows the established architecture, but it means an XSS vulnerability could expose a token. A future iteration should move to HttpOnly, SameSite cookies with CSRF protection.

## Project Identity

**Platform:** Unstable Forge  
**Tagline:** Where Ideas Take Shape.  
**Initial Audience:** ALTA campus students  
**First Featured Hackathon:** C³ (C Cube) — Crescent Code Clash

---

*Built as part of the ALTA BUILDER 30 challenge — Track A.*
