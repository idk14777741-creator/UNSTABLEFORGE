# Unstable Forge — Feature Scope

> Initial feature definition for Unstable Forge. This document establishes the intended product direction and will evolve as the project is researched and developed.

## 1. Product Overview

**Unstable Forge** is a proposed hackathon-focused platform for discovering, exploring and participating in hackathons across ALTA campuses.

The platform aims to bring participants and organizers together through a centralized experience for hackathon discovery, registration and event management.

**First featured hackathon:** C³ (C Cube) — Crescent Code Clash.

## 2. User Roles

### Participant
A student who discovers hackathons and registers to participate, individually or as part of a team.

### Organizer
An authorized user who creates hackathon listings, manages registrations and handles event operations.

### Platform Administrator
A user responsible for platform-level administration, organizer access and event oversight.

## 3. Participant Features

### Account & Profile
- User registration and login.
- Secure authentication.
- Personal profile management.
- Campus and relevant participant information.

### Hackathon Discovery
- Browse available hackathons.
- View featured and upcoming hackathons.
- Search and filter hackathons.
- Access individual hackathon information pages.

### Hackathon Information
- Event description and objectives.
- Eligibility requirements.
- Registration deadlines.
- Team-size requirements.
- Event rules and guidelines.
- Schedule and venue information.

### Registration
- Individual registration.
- Team creation.
- Team joining through an invitation or unique code.
- Team member management.
- Registration status tracking.

### Digital Tickets
- Unique digital ticket generation.
- QR-code-based ticket access.
- Personal registration history.
- Ticket verification at the event.

## 4. Organizer Features

### Hackathon Management
- Create hackathon listings.
- Edit event information.
- Publish or unpublish listings.
- Configure registration deadlines.
- Set participant capacity.
- Define individual and team registration rules.

### Registration Management
- View registered participants and teams.
- Search and filter registrations.
- Monitor registration counts.
- Manage participant information.
- Export registration data.

### Event Check-in
- Scan participant QR tickets.
- Validate ticket authenticity.
- Prevent duplicate check-ins.
- Record attendance.

## 5. Platform Administration

- Manage user accounts.
- Manage organizer access.
- Review hackathon listings.
- Oversee published events.
- Monitor platform activity.

## 6. Important System Requirements

These are functional requirements, not merely interface elements.

- Passwords must be securely hashed.
- Protected operations must require authentication and authorization.
- Registration capacity must be validated on the server.
- Concurrent registrations must not cause event overbooking.
- Team registration must validate team size and eligibility.
- Each issued ticket must have a unique, unpredictable identifier.
- QR verification must happen on the server.
- Invalid and previously checked-in tickets must be rejected.
- Users must not be able to access or modify unauthorized registrations.

## 7. Future Possibilities

Potential additions that may be considered after the core platform is established:

- Bookmarked hackathons.
- Interactive event schedules.
- Announcements and notifications.
- Competition leaderboards.
- Sponsor and partner sections.
- Advanced event analytics.
- Additional event categories beyond hackathons.

These are possibilities, not confirmed implementation commitments.

## 8. Current Scope Boundaries

The initial product is focused on hackathon discovery, registration, ticketing and event management.

Online payments, native mobile applications, AI recommendations, live chat and complex sponsor-management systems are not part of the initial scope.

## 9. Product Identity

| Element | Identity |
|---|---|
| Platform | Unstable Forge |
| Tagline | Where Ideas Take Shape. |
| Initial Audience | ALTA campus students |
| Initial Event | C³ (C Cube) |
| Full Event Name | Crescent Code Clash |

---

**Note:** The feature scope will be refined after studying the CodeFiesta and Techfest references and evaluating the actual requirements of the platform.
