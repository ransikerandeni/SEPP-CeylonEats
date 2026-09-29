# Sprint 3 planning - 7 September 2026

| | |
|---|---|
| **Meeting ID** | MTG-09 |
| **Date** | Monday 7 September 2026 |
| **Time** | 19:00 - 20:10 (Sri Lanka Standard Time) |
| **Location** | Microsoft Teams (shared screen) |
| **Sprint** | Sprint 3 (5 - 18 Sep) |
| **Current milestone** | M3 Requirements & Design (11 Sep) |
| **Chair and minutes** | Nazrin |
| **Purpose** | Set the Sprint 3 goal and take the technical decisions needed to start development. |

## 1. Attendance, apologies and quorum

| Member | Role | Attendance |
|---|---|---|
| Fathima Nazrin (CB017663) | Project Coordinator & Front-End / Documentation Lead | Present |
| Ransike Randeni (CB007131) | Back-End Developer & Repository Owner | Present |
| Abdul Maajid (CB017779) | QA & Test Automation Lead | Present |

**Apologies:** none. **Quorum:** 3 of 3 - quorate for operational, technical and baseline decisions.

## 2. Review of actions from previous meetings

| Action | Owner | Task | Due | Status | Note |
|---|---|---|---|---|---|
| A-18 | Ransike | Database design, ERD and schema (LKR pricing, Sinhala/Tamil fields) | 06 Sep | **In progress** | Schema ready for review on Friday. |
| A-21 | Ransike | Set up the development environment and push the repository to GitHub | 08 Sep | **In progress** | Local environment working; repository not pushed. |

## 3. Progress against the sprint goal and milestone

- **Sprint goal:** an approved design and database schema, and the first working slices of catalogue, search and reviews.
- Development tasks brought forward into this sprint because of the delay reported at the Sprint 2 review.

## 4. Blockers, risks and change requests

- Sprint 3 now holds both the remaining design work and the first half of development.

## 5. Decisions

| # | Decision | Rationale | Agreed |
|---|---|---|---|
| D1 | Technology stack: React + TypeScript front end, Node.js / Express 5 API, PostgreSQL database run project-locally during development. | Matches the team's skills (R10). | 3/3 |
| D2 | Review ratings use four equally weighted dimensions: food quality, customer service, value for money and ambience.  | Clearer areas for customers to rate. | 3/3 |


## 6. Work allocation for the coming period

| Action | Owner | Task | Due |
|---|---|---|---|
| A-22 | Ransike | Database migration and seed data (fictional restaurants, dishes, users) | 12 Sep |
| A-23 | Ransike | Back-end APIs: catalogue, search and filters, reviews, moderation, admin | 16 Sep |
| A-24 | Nazrin | Customer front end: search, category browse, filters, restaurant page, review form | 16 Sep |
| A-25 | Nazrin | Dashboard: moderation, restaurants, menu and prices | 18 Sep |
| A-26 | Maajid | Test environment and automated test framework | 14 Sep |

## 7. Any other business and next meeting

- None.
- **Next meeting:** M3 gate review - Friday 11 September 2026, 19:00.

---
Previous: [MTG-08](2026-09-05-sprint-2-review.md) | [Meeting register](README.md) | Next: [MTG-10](2026-09-11-m3-gate-review.md)
