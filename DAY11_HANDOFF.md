# Day 11 Handoff — C³ Participant Registration

## 1. Features Implemented

- Dedicated, authenticated registration desk at `/register`.
- Client- and server-validated registration using full name and campus. The account email is read-only and ownership comes from the bearer session, never a submitted user id.
- Duplicate registration prevention through a database uniqueness constraint and explicit `409 REGISTRATION_EXISTS` response.
- Confirmation pass with a saved display reference, participant details, account email, event, timestamp and registration status.
- Registration status survives refresh through `GET /api/registrations/me`.
- Organizer-only registration record at `/admin/registrations` with totals, campus count, search, campus filter, pagination and participant details.
- Existing entry points (hero, participation section, journey, final call to action, registration dialog and navigation) now lead to the live registration desk.
- Existing event details that are not confirmed remain TBA. No deadline, capacity, payment, team, approval or waitlist flow was invented.

## 2. Files Created and Modified

### Created

- `src/pages/RegisterPage.jsx`
- `src/pages/admin/AdminRegistrations.jsx`
- `src/day11.css`
- `DAY11_HANDOFF.md`

### Modified

- `server/auth.js` — `requireAuth` middleware.
- `server/db.js` — `registrations` table, indexes, and the one-time “Registration is now open” public announcement.
- `server/index.js` — registration validators/serializers, participant registration API and organizer registration API.
- `server/test-api.js` — 13 new registration tests.
- `src/App.jsx` — `RequireAuth`, `/register`, `/admin/registrations`.
- `src/components/Cta.jsx` — support for SPA `to` links.
- `src/components/FinalCta.jsx`, `Hero.jsx`, `Journey.jsx`, `Participate.jsx`, `RegistrationDialog.jsx`, `Nav.jsx` — live registration entry points and status copy.
- `src/data/site.js` — registration-open state and archived FAQ copy.
- `src/main.jsx` — imports `day11.css`.
- `src/pages/SignupPage.jsx` — corrected registration status copy.
- `src/pages/admin/AdminDashboard.jsx` — registration count and registration-record action.
- `README.md`, `Features.md` — Day 11 behavior, routes, schema and verification.

## 3. Database / Schema Changes

```sql
CREATE TABLE registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  full_name TEXT NOT NULL,
  campus TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (user_id, event_id),
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_registrations_event ON registrations (event_id, created_at DESC);
```

On startup, `ensureRegistrationAnnouncement()` inserts one public announcement with slug `registration-is-now-open` if it does not already exist. Existing announcements are preserved.

## 4. API Endpoints

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| `GET` | `/api/registrations/me` | Authenticated | Returns the caller's registration or `null`. |
| `POST` | `/api/registrations` | Authenticated | Validates name/campus, stores registration, returns `201`; duplicate returns `409`. |
| `GET` | `/api/admin/registrations` | Organizer/admin | Paginated record with `q` and `campus` filters; includes email, summary and campus options. |

Registration responses expose the display reference, full name, campus, account email, event and timestamps. There is no endpoint for reading another participant's registration by id.

## 5. Authentication and Authorization

- `POST /api/registrations` and `GET /api/registrations/me` use `requireAuth`.
- `GET /api/admin/registrations` uses `requireOrganizer`; participants receive `403`, signed-out requests receive `401`.
- The signed-in token subject is the only user id used for writes. A submitted `userId` is ignored.
- `/register` uses the client-side `RequireAuth` guard and preserves the intended destination through the existing `next` login flow.
- `/admin/registrations` uses the existing `RequireOrganizer` guard; the API remains authoritative.

## 6. Tests Executed

- `npm run test:api` — **72 passed, 0 failed**.
- `npm run build` — **passed** (`vite build`, 76 modules, production bundle generated).
- Browser verification against the running API and Vite server:
  - Signed-out `/register` redirected to `/login?next=%2Fregister`.
  - Created a participant account, signed in, completed registration, and saw `C3-REG-0003` with the saved name and campus.
  - Reloaded `/register` and the confirmation pass restored from `GET /api/registrations/me`.
  - Organizer sign-in loaded `/admin/registrations` with 3 live registrations and 2 campuses, participant rows and status.
  - API smoke checks confirmed `201` registration, `409` duplicate, `401` unauthenticated write, `403` participant access to the organizer record, and organizer search.

## 7. Known Limitations / Incomplete Work

- Status is `registered` only. No approval, capacity, payment or waitlist state exists because those product rules remain unconfirmed.
- The `C3-REG-####` reference is a human-readable display value derived from the database id, not a QR ticket.
- Organizer registration search/filter state resets when leaving and returning to the page.
- Registration data is scoped to the single seeded C³ event; a multi-event registration chooser is not implemented.
- Existing event logistics remain TBA and are not asserted by registration.

## 8. Git Commit and Push

- Commit: `80db690` — `feat: implement C3 participant registration flow`
- Push: pushed to `origin/main`
