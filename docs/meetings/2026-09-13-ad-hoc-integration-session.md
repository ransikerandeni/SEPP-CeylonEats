# Ad hoc working session - integration - 13 September 2026

| | |
|---|---|
| **Meeting ID** | MTG-11 |
| **Date** | Sunday 13 September 2026 |
| **Time** | 18:30 - 22:00 (Sri Lanka Standard Time) |
| **Location** | Microsoft Teams (shared screen) |
| **Sprint** | Sprint 3 (5 - 18 Sep) |
| **Current milestone** | M4 Feature complete (24 Sep) |
| **Chair and minutes** | Ransike |
| **Purpose** | Integrate the schema, API and front end into one working build and get it into the shared repository. |

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
| A-22 | Ransike | Database migration and seed data | 12 Sep | **Complete** | Migration 001 and seed data working. |
| A-21 | Ransike | Set up the development environment and push the repository to GitHub | 08 Sep | **Complete** | Closed with A-27. |
| A-07 | Ransike | Version control and change management policies; create the GitHub repository | 20 Aug | **Complete** | Repository now on GitHub; closed with A-27. |
| A-27 | Ransike | Push the repository to GitHub and commit the first build | 13 Sep | **Complete** | Repository pushed; commits 39a7056 (21:20) and ba640af (21:33). |
| A-23 | Ransike | Back-end APIs: catalogue, search and filters, reviews, moderation, admin | 16 Sep | **In progress** | Core routes working. |
| A-24 | Nazrin | Customer front end: search, category browse, filters, restaurant page, review form | 16 Sep | **In progress** | - |
| A-25 | Nazrin | Dashboard: moderation, restaurants, menu and prices | 18 Sep | **In progress** | - |

## 3. Progress against the sprint goal and milestone

- Working session on Teams with screen sharing. Schema, authenticated API, moderated reviews, discovery UI and dashboard were integrated and run end to end on a local PostgreSQL database for the first time.
- Integration worked first time for the catalogue and search; the review and moderation flow needed several fixes during the session.

## 4. Blockers, risks and change requests

- Because of the time lost in Sprints 1-3, there was no time to set up branches, pull requests and branch protection before committing.

## 5. Decisions

| # | Decision | Rationale | Agreed |
|---|---|---|---|
| D1 | Ransike would act as the single integrator for the first build and commit directly to main. The branch and pull-request workflow would be used after the first build. | Getting a working shared build before M4 was the immediate priority. | 3/3 |

## 6. Work allocation for the coming period

| Action | Owner | Task | Due |
|---|---|---|---|
| A-28 | Maajid | Write the automated integration tests against an isolated database schema | 14 Sep |
| A-29 | Ransike | Replace placeholder images with openly licensed photographs and record attribution | 14 Sep |

## 7. Any other business and next meeting

- Risk noted: with one committer, the commit history will not show individual authorship. Team to keep their own record of who wrote which part.
- **Next meeting:** Ad hoc test and review session - Monday 14 September 2026, 20:00.

---
Previous: [MTG-10](2026-09-11-m3-gate-review.md) | [Meeting register](README.md) | Next: [MTG-12](2026-09-14-ad-hoc-test-session.md)
