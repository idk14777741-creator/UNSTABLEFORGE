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

This section will be updated as features are actually implemented and concepts are understood.

---

## Project Identity

**Platform:** Unstable Forge  
**Tagline:** Where Ideas Take Shape.  
**Initial Audience:** ALTA campus students  
**Platform Focus:** Hackathons  
**First Featured Hackathon:** C³ (C Cube) — Crescent Code Clash  
**Post-Event Experience:** Project Showcase

*Built as part of the ALTA BUILDER 30 challenge — Track A.*
