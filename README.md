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

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React.js, Vite |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| Database Hosting | Supabase |
| Authentication | JWT, bcrypt |
| QR Tickets | QR code generation and scanning libraries |
| Frontend Deployment | Vercel |
| Backend Deployment | Render |

## Project Structure

The application is planned around three main layers:

- **Frontend:** User interface, navigation, dashboards and registration flows.
- **Backend:** Authentication, authorization, registration logic, ticket generation and API management.
- **Database:** Persistent storage for users, hackathons, teams, registrations and check-in records.

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

This section will document the actual implementation and concepts understood as the project develops.

## Project Identity

**Platform:** Unstable Forge  
**Tagline:** Where Ideas Take Shape.  
**Initial Audience:** ALTA campus students  
**First Featured Hackathon:** C³ (C Cube) — Crescent Code Clash

---

*Built as part of the ALTA BUILDER 30 challenge — Track A.*
