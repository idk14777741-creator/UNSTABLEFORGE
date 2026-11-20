# Day 11 & Day 12 Handoff — C³ Participant Registration and Project Showcase

This single handoff covers both milestones: Day 11 (real C³ participant registration) and Day 12 (participant project showcase). Each part keeps its own features, files, schema, API, tests, limitations and commit record.

## Commit Summary

| Milestone | Commit | Subject | Push |
|---|---|---|---|
| Day 11 | `80db690` | `feat: implement C3 participant registration flow` | `origin/main` |
| Day 12 | `ae91bee` | `feat: add participant project showcase` | `origin/main` |

Day 12's commit is the child of Day 11's commit. A commit cannot contain its own hash, so the immutable Day 12 hash is also available from `git log -1 --format=%H`.

---

# Part 1 — Day 11: C³ Participant Registration

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

---

# Part 2 — Day 12: Participant Project Showcase

## 1. Features Implemented

- Public, API-backed project showcase at `/projects`.
- Search across project title, tagline, description, technologies and public team name.
- Category filters, server-side pagination and an asymmetric exhibition layout.
- Public project detail pages at `/projects/:slug` with full description, stack, attribution, publication date, cover image and validated repository/demo links.
- Owner project desk at `/projects/mine` covering drafts, in-review, published and rejected records.
- Project submission and editing at `/projects/submit` and `/projects/:id/edit`, including a live card preview and client/server validation.
- Draft and submitted states owned by the participant; publication remains an organizer-only action.
- Published project records are locked for owners and can only be changed or removed by an organizer.
- Organizer moderation wall at `/admin/projects` with summary counts, search, status/category filters, pagination, expandable submission details and publish/reject/unpublish/return-to-review actions.
- Showcase links in the primary navigation, mobile navigation and footer; a submission link appears on the public gallery.
- Admin dashboard project count and moderation entry point.
- No seeded/fake projects: the public showcase uses a designed empty state until real work is submitted and published.

## 2. Files Created and Modified

### Created

- `src/data/projects.js`
- `src/pages/ProjectsPage.jsx`
- `src/pages/ProjectDetail.jsx`
- `src/pages/MyProjectsPage.jsx`
- `src/pages/ProjectEditor.jsx`
- `src/pages/admin/AdminProjects.jsx`
- `src/day12.css`

### Modified

- `server/db.js` — project table and indexes.
- `server/index.js` — project validation, serialization and public/owner/organizer APIs; published records cannot be edited by owners.
- `server/test-api.js` — 24 new project lifecycle and authorization tests.
- `src/App.jsx` — showcase, detail, owner desk, submission/editor and moderation routes with auth guards.
- `src/components/Nav.jsx` — project navigation, active state, dark-header treatment and mobile project desk link.
- `src/components/Footer.jsx` — showcase footer link.
- `src/data/site.js` — shared project route metadata.
- `src/main.jsx` — imports `day12.css`.
- `src/pages/admin/AdminDashboard.jsx` — project count and moderation action.
- `README.md`, `Features.md` — Day 12 routes, behavior, schema, API and verification.
- `DAY11_HANDOFF.md` — corrected final Day 11 commit hash (`80db690`). That file was later merged into this consolidated handoff.

## 3. Database / Schema Changes

```sql
CREATE TABLE projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL,
  technologies TEXT NOT NULL DEFAULT '[]',
  team_name TEXT,
  repo_url TEXT,
  demo_url TEXT,
  cover_image_url TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'submitted', 'published', 'rejected')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX idx_projects_public ON projects (status, published_at DESC);
CREATE INDEX idx_projects_event ON projects (event_id);
CREATE INDEX idx_projects_owner ON projects (user_id);
```

## 4. API Endpoints

| Method | Endpoint | Access | Behavior |
|---|---|---|---|
| `GET` | `/api/projects` | Public | Published projects only; supports `q`, `category`, `page`, `limit`. |
| `GET` | `/api/projects/:identifier` | Public | Published project by id or slug; non-published records return `404`. |
| `GET` | `/api/projects/mine` | Authenticated owner | All records owned by the session user. |
| `GET` | `/api/projects/mine/:id` | Authenticated owner | Owner record; another owner receives `404`. |
| `POST` | `/api/projects` | Authenticated | Creates a draft or submitted project owned by the session user. |
| `PATCH` | `/api/projects/:id` | Authenticated owner | Edits an unpublished owner record; non-owner receives `403`; published record returns `409`. |
| `DELETE` | `/api/projects/:id` | Owner or organizer | Owner may delete only unpublished records; organizer may delete any record. |
| `GET` | `/api/admin/projects` | Organizer/admin | Full moderation record with `q`, `status`, `category`, pagination and summary counts. |
| `PATCH` | `/api/admin/projects/:id` | Organizer/admin | Sets `published`, `submitted` or `rejected`; publication is manual. |

Project slugs are generated from the title and made unique. Public responses never include `ownerId` or `ownerEmail`. Repository links must be HTTPS GitHub URLs; demo and cover URLs must be HTTP(S) without embedded credentials.

## 5. Authentication and Authorization

- Public list/detail endpoints expose published records only.
- Every owner and organizer route requires a bearer token.
- Project ownership and event association come from the authenticated session, never a request-supplied user id.
- Owner list/detail queries are scoped to the session user.
- Participants cannot call `/api/admin/projects` (`403`) and cannot self-publish (`400`).
- Owners cannot edit or delete a published project (`409`); organizers can unpublish, reject or delete.
- `RequireAuth` and `RequireOrganizer` protect the client routes, while the Express middleware remains authoritative.

## 6. Tests Executed

- `npm run test:api` — **96 passed, 0 failed**.
- `npm run build` — **passed** (`vite build`; production CSS and JS emitted).
- Browser verification against the running API and Vite server:
  - A signed-in participant created and submitted a real project through `/projects/submit`.
  - `/projects/mine` showed the project as `IN REVIEW` and the public route returned `404` before publication.
  - Organizer `/admin/projects` showed the submission with owner details, expanded the full description and stack, then published it.
  - `/projects` displayed the real card, and `/projects/forge-signal` rendered the real detail record with links and without account data.
  - The owner's edit route showed the published lock instead of an editable form.
  - Public search (`q=Forge`) returned the real project and updated the URL. The temporary project was deleted after verification.

## 7. Known Limitations / Incomplete Work

- Cover images are external URLs; there is no image upload or storage pipeline.
- Descriptions are plain text with blank-line paragraphs; no rich text or media embeds.
- No team-member entity, project revision history or organizer review comment field.
- After an organizer unpublishes a project, an owner can edit and resubmit it; there is no separate change-request workflow.
- Team Finder is intentionally not implemented.
- The showcase starts empty in a clean database until real projects are submitted and published.
