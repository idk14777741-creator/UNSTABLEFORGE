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

## Routes, Authentication and the Editorial Desk

The current build is the Unstable Forge event site for C³, with a client-side history router and a bearer-token API.

### Routes

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Landing page for Unstable Forge and C³ |
| `/login` | Guests | Sign in with an existing account |
| `/signup` | Guests | Create a participant account |
| `/register` | Signed-in participants | C³ registration desk and saved registration status |
| `/announcements` | Public | Searchable, filtered announcement archive |
| `/announcements/:slug` | Public | Announcement detail |
| `/admin` | Organizer / admin | Control room dashboard |
| `/admin/announcements` | Organizer / admin | Announcement management, including drafts |
| `/admin/announcements/new` | Organizer / admin | Create a dispatch |
| `/admin/announcements/:id/edit` | Organizer / admin | Edit an existing dispatch |
| `/admin/registrations` | Organizer / admin | Searchable participant registration record |
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

### Live Announcement Experience (Day 9)

The public event experience reads announcements directly from the existing Express/SQLite API. No hardcoded announcement arrays or fabricated event details are used.

- The homepage **LATEST FROM THE FORGE** section calls `GET /api/announcements?limit=3` and renders the newest published dispatches, with direct links to each detail page and to the full archive.
- `/announcements` calls `GET /api/announcements` with `q`, `category`, `page` and `limit` parameters. It opens with a featured latest dispatch on the default first page, then shows the remaining cards, result counts, category filters, search and pagination.
- `/announcements/:slug` calls `GET /api/announcements/:slug` and renders the complete title, category, publication date and content.
- Only published records are returned by the public API. Drafts return `404`, including when a draft slug is requested directly.
- The listing and detail routes include skeleton loading states, designed empty states, network-error messages and retry actions. Invalid, deleted or unpublished slugs resolve to a clear not-found state.
- The homepage live section has its own loading, empty and unreachable states. Its retry action re-requests the latest dispatches without reloading the page.
- The latest-dispatch feature and homepage cards use the same live data as the archive. When the API changes, a reload of the homepage reflects the new order immediately.

Previous/next links on the detail page are intentionally not fabricated. The existing API exposes ordered pagination and filtering but not adjacency metadata, so the detail page links back to the archive instead of guessing neighbours.

### Admin Announcement Management (Day 10)

`/admin/announcements` is the organizer's editorial desk. It is protected by the existing route guard and every request is still authorized by `requireOrganizer` on the Express API.

- The overview lists the actual announcement record with status, title, slug, category, publication date, last edit date and row actions. Totals for all dispatches, public dispatches and drafts come from the API summary.
- Search (title and content) and status filters (all, published, drafts) use the existing `GET /api/admin/announcements` endpoint. Pagination updates without leaving the desk.
- **Create** and **edit** use the real `POST /api/announcements` and `PATCH /api/announcements/:id` endpoints. The editor contains title, content, category, optional slug and publication state, with client validation, server field errors, character counts, an estimated reading time and a local live preview.
- Submission is loading-aware and guarded against duplicate requests. A failed save leaves the form populated and the save action available for retry. Closing the browser is guarded, and Cancel opens a discard confirmation when there are unsaved changes.
- **Publish/unpublish** uses `PATCH /api/announcements/:id`. The server controls public visibility; a successful change immediately affects the public archive, detail route and homepage wire. Each action reports success or failure in the manager.
- **Delete** never fires from the row button. A confirmation dialog identifies the dispatch, shows its slug and status, traps keyboard focus, supports Escape to cancel, and only sends the real `DELETE /api/announcements/:id` after explicit confirmation. Deletion is irreversible.
- Empty, loading, filtered-empty and network-error states are provided for the record. Drafts remain visible only through the authenticated organizer API.

### C³ Participant Registration (Day 11)

`/register` is the real participant entry desk, connected to the authenticated account and the SQLite event record.

- Signed-out visitors are sent through the existing login flow and returned to `/register` after sign-in.
- The form collects only the full name and campus needed for the event record. The account email is read-only and the server derives ownership from the session token; a client-supplied `userId` is ignored.
- Registration requires 2–120 characters for both fields, validates on the client and server, and returns field-level messages. A database `UNIQUE (user_id, event_id)` constraint and an explicit conflict response reject duplicate registration with `409 REGISTRATION_EXISTS`.
- A successful registration returns a saved record with a display reference (`C3-REG-####`), name, campus, account email, event and timestamp. Reloading the desk fetches `/api/registrations/me`, so the confirmation pass survives refresh.
- The participant API exposes only `/api/registrations/me`; there is no endpoint for reading another participant's record.
- `/admin/registrations` is the organizer-only entry record. It provides totals, campus count, search by name/email/campus, campus filtering, pagination and registration timestamps from the live API.
- `requireAuth` protects participant writes and `requireOrganizer` protects the organizer record server-side. A participant calling the organizer endpoint receives `403`.
- The homepage, participation copy, journey, registration dialog and navigation now point to the open registration desk while preserving every event detail still marked TBA. No capacity, deadline, payment, team or approval workflow was invented.

### Visual Evolution (Day 10)

The public and organizer experiences now share a chapter-based editorial system rather than generic dashboard patterns.

- The homepage carries a fixed chapter HUD after the hero, tracking the active chapter from 01 to 09. Section labels were renumbered to match the same sequence.
- The participation specifications became a ticket-style **Build Pass** with clear status, facts and a direct path to the dispatches. It keeps every value marked TBA rather than inventing details.
- Announcement cards carry restrained category-specific accents, and detail pages show reading time and a more useful archive rail.
- The organizer interface is an **editorial desk**: a summary strip, publication desk, metadata panel, live preview and a typographic form layout consistent with the public brand rather than a generic SaaS table.
- Motion was kept purposeful: page-entry transitions, the chapter HUD and existing reveal effects, with reduced-motion support. The visual research adapted CodeFiesta's campaign framing and Techfest's information clarity; no reference assets, layouts or brand identities were copied.

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

The suite covers public announcements, newest-first ordering, organizer CRUD, signup validation, duplicate accounts, participant login, role-based `403`s, draft visibility, admin filtering, invalid sessions, registration validation, registration persistence, duplicate rejection and organizer registration search/filtering. Day 11 finished with **72 passing checks**.

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

Day 9 connected the public experience to the live event record: the homepage now carries a real **LATEST FROM THE FORGE** section, the archive opens with a featured dispatch, and the detail route handles real loading, missing and network states. I verified that a newly published dispatch appeared on both the homepage and its detail URL, and disappeared from both after deletion.

Day 10 made the organizer workflow safe enough to use rather than simply present: the editorial desk writes to the same SQLite record as the public site, distinguishes publication from drafting, confirms destructive actions, previews the dispatch as it is written, and keeps validation both client- and server-side. The visual work also clarified a principle I want to carry forward: motion and atmosphere should explain the event, while practical information should remain direct and easy to find.

Manual browser checks covered login success/failure, signup and duplicate handling, refresh persistence, protected redirects and return paths, participant vs organizer access, logout, expired sessions, direct nested-route loads and mobile layouts. Day 10 checks covered the live management table, create, edit, publish, unpublish, delete confirmation and cancellation, API failure recovery, the live preview, draft filtering, public visibility after each change, chapter HUD activation, responsive desk and pass layouts. Day 11 checks covered the signed-out redirect to login, a real participant registration, the confirmation pass, refresh persistence, duplicate rejection through the API, and the organizer entry record with live totals and detail rows. The full API suite passes 72/72 and the production build succeeds.

Known limitations: the existing API is bearer-token based, so the session is kept in `localStorage`; an XSS vulnerability could expose a token, and a future iteration should move to HttpOnly, SameSite cookies with CSRF protection. Detail-page previous/next navigation is not implemented because the announcement API does not expose adjacency metadata. Announcement content remains plain text (blank lines become paragraphs) because that is the existing API contract; rich text, media uploads, scheduled publishing and revision history are not implemented.

## Project Identity

**Platform:** Unstable Forge  
**Tagline:** Where Ideas Take Shape.  
**Initial Audience:** ALTA campus students  
**First Featured Hackathon:** C³ (C Cube) — Crescent Code Clash

---

*Built as part of the ALTA BUILDER 30 challenge — Track A.*
