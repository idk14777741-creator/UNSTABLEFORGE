# Unstable Forge — Feature Scope & Architecture

> Where Ideas Take Shape.

## 1. Product Overview

Unstable Forge is a hackathon discovery, registration, participation and project showcase platform initially designed for students across ALTA campuses.

It brings hackathon organizers and participants together through a centralized platform where students can discover opportunities, explore problem statements, register individually or in teams, receive digital tickets and eventually showcase the projects they build.

The first featured hackathon planned for the platform is **C³ (C Cube) — Crescent Code Clash**.

### Product Scope

- Primary focus: Hackathons.
- Initial audience: ALTA campus students.
- Registration: Individual and team-based.
- Organizer tools: Hackathon publishing and participant management.
- Post-event experience: Project Showcase.
- Future expansion: Team Finder and other community features.

## 2. User Roles

### Participant
A student who discovers hackathons, registers, participates and publishes projects.

### Team Leader
A participant who creates a team, manages invitations and handles team-level registration and project submissions.

### Organizer
An authorized user who creates hackathons, manages registrations, publishes announcements and handles check-ins.

### Platform Administrator
A user responsible for platform-level administration, organizer permissions and event oversight.

> **Implemented today:** the backend has `participant`, `organizer` and `admin` roles. Public signup creates participants only. The seeded organizer account can access the control room; `admin` is also accepted by the authorization middleware. Team Leader remains a planned product role and is not yet a stored role.

## 3. Hackathon Discovery

- Browse upcoming, ongoing and completed hackathons.
- Featured hackathons on the homepage.
- Search by hackathon name, domain or technology.
- Filter by registration status, dates, location and participation format.
- Dedicated hackathon detail pages.
- Clear indicators for upcoming, open, closing soon, full and closed registrations.

## 4. Hackathon Detail Pages

Every hackathon should have a consistent information structure while allowing its own visual identity.

### Event Information
- Hackathon description and objectives.
- Banner and event identity.
- Eligibility and participating campuses.
- Online or offline format.
- Venue and reporting information.
- Registration deadlines and capacity.

### Competition Information
- Tracks and themes.
- Problem statements.
- Team-size requirements.
- Rules and guidelines.
- Submission requirements.
- Prizes and sponsors, where applicable.

### Event Experience
- Interactive timeline and schedule.
- Frequently asked questions.
- Organizer contact information.
- Announcements and important updates.

## 5. Participant Accounts

- User registration and login.
- Secure password storage.
- Participant profile management.
- Campus information.
- My Events dashboard.
- Registration history.
- Digital ticket access.
- Relevant event announcements.

Public hackathon discovery and event information should remain accessible without requiring an account.

## 6. Registration & Team Management

### Individual Registration
- Register as an individual.
- Validate eligibility and registration status.
- Confirm successful registration.
- Generate a unique digital ticket.

### Team Registration
- Create a team with a team name.
- Generate a unique invitation code.
- Invite and manage team members.
- Accept or reject invitations.
- Validate team size and eligibility.
- Submit registration once the team satisfies the event requirements.

Team creation alone should not reserve hackathon capacity. Capacity should be reserved only when registration is successfully confirmed.

## 7. Digital Tickets & Check-in

- Generate unique QR-based tickets.
- Associate tickets with confirmed registrations.
- Allow participants to access their tickets.
- Provide an organizer-side QR scanner.
- Validate tickets through the backend.
- Reject invalid or previously checked-in tickets.
- Record check-in timestamps and attendance.

Each participant should have an independently verifiable ticket, including participants registered as part of a team.

## 8. Organizer Dashboard

### Hackathon Management
- Create and edit hackathon listings.
- Publish and unpublish hackathons.
- Configure registration deadlines.
- Set participant capacity.
- Configure individual and team registration.
- Manage tracks, problem statements and event information.

### Participant Management
- View individual registrations and teams.
- Search and filter participants.
- Monitor registration counts.
- Export participant information.
- View check-in and attendance records.

### Event Communication
- Publish announcements.
- Update important event information.
- Communicate changes to registered participants through the platform.

## 9. Project Showcase

Project Showcase is a core part of the Unstable Forge product vision.

It allows teams to publish what they built after participating in a hackathon, turning completed events into a growing collection of student projects.

### Project Submissions
- Submit a project against a hackathon.
- Add project title and description.
- Associate the project with its problem statement or track.
- List technologies and tools used.
- Add repository and live demo links.
- Display team members and contributors.
- Add project screenshots or media where supported.

### Public Project Gallery
- Browse completed hackathon projects.
- View individual project pages.
- Discover projects by hackathon, domain or technology.
- View project descriptions, team information and demo links.

### Organizer Controls
- Configure project submission deadlines.
- Review submissions.
- Approve, reject or request changes.
- Control whether projects are publicly visible.

Project submissions must be associated with a valid hackathon and its registered participants or teams.

## 10. Platform Administration

- Manage user accounts.
- Manage organizer permissions.
- Review hackathon listings.
- Oversee published hackathons.
- Monitor registrations and platform activity.

## 11. Important System Requirements

- Passwords must be securely hashed.
- Protected operations must require authentication and role-based authorization.
- Registration eligibility must be validated on the backend.
- Concurrent registrations must not exceed available participant capacity.
- Team membership and size limits must be enforced server-side.
- Registration confirmation and capacity reservation must be transactional.
- Every ticket must have a unique, unpredictable identifier.
- QR verification must happen on the backend.
- Duplicate check-ins must be prevented.
- Project submissions must be linked to authorized participants and hackathons.
- Organizers must only manage hackathons they are authorized to control.

## 12. Future Features

These are not part of the initial implementation commitment.

- Team Finder and teammate discovery.
- Public skill and interest profiles.
- Event-specific discussion spaces.
- Advanced notifications and preferences.
- Hackathon Passport and participation achievements.
- Certificates and downloadable credentials.
- Leaderboards and competition results.
- Advanced organizer analytics.
- Additional event categories beyond hackathons.

## 13. Out of Scope for the Initial Build

- Online payment processing.
- AI-based hackathon recommendations.
- Native mobile applications.
- Live messaging and chat infrastructure.
- Public teammate matching.
- Complex sponsor-management systems.
- General-purpose event management.

## 14. Proposed Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js + Vite |
| Styling | Tailwind CSS |
| Backend | Node.js + Express.js |
| Database | PostgreSQL |
| Database Hosting | Supabase |
| Authentication | JWT + bcrypt |
| QR Generation | QR code library |
| QR Scanning | Browser-based QR scanner |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |

The stack is proposed for a zero-budget initial implementation. Free-tier restrictions and deployment limitations must be considered during development.

## 15. Proposed Architecture

Unstable Forge will initially use a modular monolithic architecture.

The frontend, backend and database will be separate application layers, while backend functionality will be organized into focused modules.

### Frontend Modules
- Public discovery and homepage.
- Hackathon detail pages.
- Authentication and participant profiles.
- Team and registration interfaces.
- Participant dashboard and tickets.
- Organizer dashboard.
- Project showcase and project detail pages.

### Backend Modules
- Authentication and authorization.
- User and profile management.
- Hackathon and track management.
- Problem statement management.
- Team and membership management.
- Registration and capacity management.
- Ticket generation and verification.
- Check-in and attendance.
- Announcements.
- Project submissions and moderation.

### Database Entities

The initial relational database is expected to contain:

- `users`
- `campuses`
- `organizer_profiles`
- `hackathons`
- `hackathon_tracks`
- `problem_statements`
- `teams`
- `team_members`
- `registrations`
- `tickets`
- `check_ins`
- `announcements`
- `project_submissions`

Additional entities such as FAQs, timelines and project media may be introduced where normalization and implementation requirements justify them.

## 16. Data Integrity & Security

- Unique user email addresses.
- Unique team invitation codes.
- One active registration per participant per hackathon.
- Enforced team-size constraints.
- Transactional capacity reservation.
- Unique ticket identifiers.
- Atomic check-in validation.
- Ownership checks for organizer operations.
- Project submission authorization.
- Server-side validation for all important operations.

## 17. What I Built and What I Understood

This project is intended to develop practical full-stack engineering skills through a real-world product.

The implementation should demonstrate an understanding of:

- Frontend and backend communication through REST APIs.
- Authentication and role-based authorization.
- Relational database design.
- Individual and team registration workflows.
- Transactional capacity management.
- Secure QR-based ticketing.
- Event check-in systems.
- Project submission and moderation workflows.
- Testing, deployment and application security.

### Day 8 — Frontend Routing and Authentication

Day 8 turned the event site into a routed application without replacing its visual identity or its existing authentication system.

#### Routing

- Client-side history routing via `src/lib/router.jsx`, with `Link` navigation and browser back/forward support.
- Public: `/`, `/login`, `/signup`, `/announcements`, `/announcements/:slug`.
- Protected: `/admin`, `/admin/announcements`, `/admin/announcements/new`, `/admin/announcements/:id/edit`.
- `/unauthorized` provides a designed 403 state for signed-in participants; unknown paths render a branded 404.
- Direct refresh of nested routes is supported by Vite and by the Express SPA fallback.
- Loading states cover session resolution, redirects, announcement fetches and editor loads.

#### Authentication

- Login and signup use the real Express endpoints; no simulated client-side authentication.
- Signup accepts email and password only, validates them on both client and server, handles duplicate emails, and creates a participant account without issuing a token.
- Login supports show/hide password, client validation, server error mapping, disabled/loading submission, success feedback and redirect to the requested destination.
- `AuthProvider` centralizes `checking`, `anonymous` and `authenticated` state. It restores the stored bearer session, checks expiry and validates it with `/api/auth/me` before protected content renders.
- Sessions survive refresh; signed-in users skip login/signup; logout clears the session; a `401` clears it and shows an expired-session notice.
- Client role checks control navigation and UX only. `requireOrganizer` remains authoritative on the API and returns `403` for participants.

#### Organizer Control Room

The control room reuses the Day 7 announcement API. It provides counts for total, published and draft dispatches; recent activity; search, status filters and pagination; publish/unpublish; edit; and delete with confirmation. The editor creates or updates dispatches and keeps publication state explicit.

#### Verification

`npm run test:api` passes 58/58 checks, covering signup validation, duplicate accounts, participant login, participant `403`s, organizer-only draft access, invalid admin filters and invalid sessions. Browser checks covered login success/failure, signup and duplicate handling, refresh persistence, protected redirects and return paths, admin vs participant access, logout, expiry recovery, nested-route refresh, mobile layouts and existing landing functionality.

#### Known Limitation

Because the existing API issues bearer tokens, the frontend stores the session in `localStorage`. The backend remains authoritative, but an XSS vulnerability could expose a token. Moving the session to HttpOnly, SameSite cookies with CSRF protection is a future security improvement.

### Day 9 — Dynamic Event Experience and Live API Integration

Day 9 connected the public event experience to the real announcement record without replacing the existing pages or introducing a parallel data source.

#### Live Announcement Surfaces

- **Homepage — LATEST FROM THE FORGE:** fetches the three newest published announcements from `GET /api/announcements?limit=3`. The lead dispatch links to its detail page; the two supporting dispatches form an editorial side rail. The section links to the full archive and fits between the event stakes and participation sections.
- **Archive — `/announcements`:** uses the existing `GET /api/announcements` endpoint for search (`q`), category filtering, pagination (`page`, `limit`) and newest-first ordering. On the default first page, the newest dispatch becomes a full-width featured lead; the remaining cards start at index 02. Filters and later pages show the normal grid only.
- **Detail — `/announcements/:slug`:** fetches `GET /api/announcements/:slug` and renders the complete content, title, category and publication date, with a clear route back to the archive.

#### States and Safety

- Skeleton cards cover archive and detail loading; the homepage has a matching dark feature skeleton and side-rail skeletons.
- Empty archives and empty homepage feeds have designed messages rather than fabricated dispatches.
- Network failures show a useful message and an in-place retry action. Detail failures distinguish unavailable from not found.
- Invalid, deleted and unpublished slugs resolve to the public not-found state. The public API excludes drafts, so unpublished content is never exposed through the frontend.
- No previous/next links are fabricated: the available API has ordered pagination but no adjacency metadata, so the detail page returns to the archive instead.

#### Verification

`npm run test:api` passes **59/59** checks, including newest-first ordering and the existing publication/authorization coverage. Browser checks confirmed that a newly published dispatch appears first on the homepage and on its detail URL, then disappears from both after deletion. Archive search, category filters, featured lead placement, card indexing, pagination, empty states, retry flows, skeleton loading, direct detail refreshes, unpublished `404`s and mobile layouts were exercised against the running API.

### Day 10 — Editorial Desk and Visual Evolution

Day 10 completed the organizer announcement workflow and evolved the public experience into a more coherent, chapter-driven event site. Existing routes, authentication, APIs and data models were preserved.

#### Announcement Management

- `/admin/announcements` loads the real organizer record with a summary of all, public and draft dispatches, plus search, status filters and pagination.
- Each row shows publication state, title, slug, category, publication date, last-edited date and available actions.
- Create and edit share a dedicated **editorial desk** rather than a generic form. Title, content, category, optional slug and publication state are validated on both client and server, with field-level error messages and focus to the first invalid field.
- The editor shows word count, character count, estimated reading time, dispatch metadata and a live local preview of the card. Public dispatches also expose a direct link to their public page.
- Save operations disable duplicate submissions, retain the form after a failed request, and recover the button state. Unsaved edits trigger a discard confirmation and a browser unload warning.
- Publish and unpublish write through the existing `PATCH /api/announcements/:id` endpoint. The list reports success or failure and refreshes from the API.
- Delete opens a modal confirmation with the dispatch title, slug and state. Escape cancels, focus is trapped and restored, background scrolling is locked, and the real `DELETE` request is sent only after confirmation.

#### Visual Evolution

- A fixed chapter HUD tracks the active homepage section from 01 to 09 after the hero, aligning the section labels into one campaign sequence.
- The participation specifications now read as a ticket-style **Build Pass**, preserving all TBA statuses while making the information scannable.
- Announcement cards use restrained category accents and detail pages show reading time and a clearer archive rail.
- The organizer screens use the same ink, ivory, copper, mono labels and display typography as the public site. The management page has a summary strip and the editor has a publication desk, metadata panel and preview rather than a generic dashboard.
- Page-entry motion and the HUD are restrained and respect reduced-motion preferences. The design research adapted CodeFiesta's campaign framing and Techfest's information clarity without copying their assets, branding or layouts.

#### Verification

`npm run test:api` passes **59/59** checks against the existing API, including organizer CRUD, role authorization, public-only visibility, newest-first ordering and invalid sessions. Browser verification created a real dispatch, edited its title/content/category, published it, saw it appear on the public detail page and homepage, unpublished it, confirmed public `404`, republished it, and deleted it after confirming the modal. Client validation, API failure recovery, draft filtering, live preview, mobile management layouts, modal focus handling and existing login/protected routing were also exercised.

#### Known Limitations

Announcement content remains plain text with blank-line paragraphs, matching the existing API. Rich text, media uploads, scheduled publishing and revision history are not implemented. The detail page still has no previous/next links because the API does not expose adjacency metadata. Admin search, status and page selection reset when returning from the editor.

### Day 11 — C³ Participant Registration

Day 11 added the real participant entry flow on the existing account, API and SQLite foundation. No second authentication system or parallel event store was introduced.

#### Registration Experience

- `/register` is a dedicated registration desk inside the existing visual system, with an editorial brief, entry steps, live event facts and a confirmation pass.
- Signed-out users are redirected through `/login?next=/register` and returned to the desk after authentication.
- The form collects full name, campus and the read-only account email. No payment, team, phone, approval or waitlist data is invented.
- Loading, ready, submitting, validation, duplicate, success, network-error and retry states are implemented. Field errors focus the first invalid field.
- The confirmation shows the saved registration reference, participant name, campus, account email, status, event and filing date. Reloading `/register` restores this record from the API.

#### Database and API

- New `registrations` table: `id`, `event_id`, `user_id`, `full_name`, `campus`, `created_at`, with `UNIQUE (user_id, event_id)` and foreign keys to events and users.
- `GET /api/registrations/me` returns the signed-in participant's registration or `null`.
- `POST /api/registrations` requires authentication, validates full name and campus, ignores any client-supplied user id, and returns `201` with a display reference such as `C3-REG-0001`.
- Duplicate registration is rejected with `409 REGISTRATION_EXISTS`; the database constraint is the final guard.
- There is deliberately no cross-participant registration endpoint. Another participant's record cannot be fetched by id.
- `GET /api/admin/registrations` is organizer-only, supports `q`, `campus`, `page` and `limit`, and returns participant name/email/campus plus totals and campus options. `requireOrganizer` enforces access on the server.

#### Organizer Desk

- `/admin/registrations` shows live totals, campus count, search, campus filter, pagination, timestamps and status for every saved registration.
- Loading, empty, filtered-empty, error and retry states are designed; participant emails appear only in this authenticated organizer view.

#### Verification

`npm run test:api` passes **72/72** checks. New coverage includes authentication requirements, registration validation, successful registration, account-bound ownership despite an arbitrary `userId`, duplicate `409`, persistence through `/me`, absence of a cross-participant endpoint, participant `403` on the organizer record, and organizer search/campus filtering. `npm run build` succeeds. Browser checks confirmed the signed-out redirect, real registration, confirmation pass, refresh persistence and the organizer record with live rows.

#### Known Limitations

Registration status is a single confirmed `registered` state because no approval, capacity, payment or waitlist rules have been confirmed. The display reference is derived from the database id for human use; it is not a separate ticket or QR credential. Event logistics remain TBA.

### Day 12 — Participant Project Showcase

Day 12 turned the planned showcase into a real, curated exhibition backed by participant submissions and organizer moderation.

#### Public Showcase

- `/projects` reads only `published` projects from the existing SQLite database through `GET /api/projects`.
- Search covers title, tagline, description, technologies and public team/creator attribution. Category filters, pagination, loading skeletons, empty states, filtered-empty states, network errors and retry actions are implemented.
- Project cards use an asymmetric exhibit grid rather than a uniform CRUD table: a single published project becomes a split full-width feature, two or four projects form paired rows, and larger result sets alternate broad cards with a three-up wall.
- Cards show title, tagline, category, technologies, public attribution and optional cover image. Missing covers use a typographic fallback; no placeholder projects are seeded.

#### Project Detail

- `/projects/:slug` loads real published data from the public API.
- Full descriptions render as plain-text paragraphs. The page includes the technology stack, public attribution, category, publication date, event, optional cover image and validated repository/demo links.
- External links open in a new tab with `noopener noreferrer`. Owner account IDs and emails are never serialized into public project responses.

#### Participant Submission and Ownership

- Signed-in participants can create and edit their own projects at `/projects/submit`, `/projects/mine` and `/projects/:id/edit`.
- Fields: title, tagline, full description, category, 1–12 technologies, optional public team/creator name, optional GitHub repository, optional live demo and optional cover image URL.
- Validation is duplicated on the client and server. Titles are 3–120 characters, taglines 8–160, descriptions 40–12,000, each technology 40 characters or fewer, and all links must be HTTP(S); repository links must be HTTPS GitHub URLs.
- The owner and event are assigned from the authenticated session. A submitted user id is ignored.
- Owners can save `draft` or `submitted`, return a submission to draft, and delete unpublished records. They cannot set `published`, edit a published record or delete a published record.
- `/api/projects/mine` only returns the signed-in owner's records; `/api/projects/mine/:id` returns `404` for another owner's project.
- The editor includes a live card preview, character counts, field-level server errors and explicit save-draft versus submit-for-review actions.

#### Organizer Moderation

- `/admin/projects` is protected by the existing organizer route guard and `requireOrganizer` on every API call.
- The moderation wall shows real summary counts for all, in-review, published and rejected projects; search, status filters, category filters and pagination use the API.
- Rows expose title, category, public team name, owner email, state and last update. Expanding a row shows the tagline, full description, stack, creation/publication dates and external links.
- `PATCH /api/admin/projects/:id` publishes, rejects/unpublishes or returns a submission to review. Publication is never automatic, and rejection immediately removes public access.

#### Database and API

- `projects` table: event and user foreign keys, title, unique slug, tagline, description, category, JSON technology list, public team name, repository/demo/cover URLs, status (`draft`, `submitted`, `published`, `rejected`), timestamps and publication timestamp.
- Public: `GET /api/projects`, `GET /api/projects/:identifier`.
- Owner: `GET /api/projects/mine`, `GET /api/projects/mine/:id`, `POST /api/projects`, `PATCH /api/projects/:id`, `DELETE /api/projects/:id`.
- Organizer: `GET /api/admin/projects`, `PATCH /api/admin/projects/:id`.

#### Verification

`npm run test:api` passes **96/96** checks. Project coverage includes authentication, validation and unsafe URL rejection, session-derived ownership, private draft visibility, owner listing, non-owner edit rejection, self-publication rejection, organizer-only moderation, publishing, public detail privacy, real search, published-record locking, rejection/unpublication, return to review and cleanup. `npm run build` succeeds. Browser checks submitted a real project through the form, observed it enter review, expanded it in the moderation wall, published it, confirmed the public card and detail page, and verified the owner lock after publication.

#### Known Limitations

The showcase has no media upload pipeline; cover images are supplied as external URLs. Project descriptions are plain text, matching the existing announcement content model. There is no revision history, team-member entity, review comment field or automatic re-review after an organizer unpublishes and an owner edits. Team Finder is intentionally not part of this milestone.

This section is updated as features are actually implemented and concepts are understood.

---

## Project Identity

**Platform:** Unstable Forge  
**Tagline:** Where Ideas Take Shape.  
**Initial Audience:** ALTA campus students  
**Platform Focus:** Hackathons  
**First Featured Hackathon:** C³ (C Cube) — Crescent Code Clash  
**Post-Event Experience:** Project Showcase

*Built as part of the ALTA BUILDER 30 challenge — Track A.*
