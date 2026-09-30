# Ad hoc working session - testing and review - 14 September 2026

| | |
|---|---|
| **Meeting ID** | MTG-12 |
| **Date** | Monday 14 September 2026 |
| **Time** | 20:00 - 22:40 (Sri Lanka Standard Time) |
| **Location** | Microsoft Teams (shared screen) |
| **Sprint** | Sprint 3 (5 - 18 Sep) |
| **Current milestone** | M4 Feature complete (24 Sep) |
| **Chair and minutes** | Maajid |
| **Purpose** | Run the automated tests, fix defects and record the test results. |

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
| A-26 | Maajid | Test environment and automated test framework | 14 Sep | **Complete** | node:test + supertest running against an isolated PostgreSQL schema. |
| A-28 | Maajid | Write the automated integration tests against an isolated database schema | 14 Sep | **Complete** | 12 automated tests written; 12 passing by end of session. |
| A-29 | Ransike | Replace placeholder images with openly licensed photographs and record attribution | 14 Sep | **Complete** | 24 licensed photographs with attribution in image-credits.json. |
| A-23 | Ransike | Back-end APIs: catalogue, search and filters, reviews, moderation, admin | 16 Sep | **Complete** | All 18 API routes working. |
| A-24 | Nazrin | Customer front end: search, category browse, filters, restaurant page, review form | 16 Sep | **Complete** | - |
| A-25 | Nazrin | Dashboard: moderation, restaurants, menu and prices | 18 Sep | **Complete** | - |

## 3. Progress against the sprint goal and milestone

- Testing showed that one account could post several reviews for the same dish and affect its rating.
- This was fixed with migration 002, allowing one review per dish and one review for the restaurant, with rewriting allowed after rejection (CR-006).
- Build, formatting and whitespace checks passed. Test evidence was added to docs/TESTING.md, including nine manual browser scenarios.

## 4. Blockers, risks and change requests

- A comment-only edit was made to migration 002 after it had been applied (commit ae888a2). No effect on the database, but it breaks the append-only rule (CR-011).

## 5. Decisions

| # | Decision | Rationale | Agreed |
|---|---|---|---|
| D1 | One review per author per dish and per restaurant (CR-006). | Prevents rating manipulation by repetition (R8). | 3/3 |


## 6. Work allocation for the coming period

| Action | Owner | Task | Due |
|---|---|---|---|
| A-30 | Nazrin | Compile the final Planning & Feasibility pack and bibliography | 19 Sep |

## 7. Any other business and next meeting

- None.
- **Next meeting:** Ad hoc session (Stage 2 finalisation) - Thursday 17 September 2026, 19:00.

---
Previous: [MTG-11](2026-09-13-ad-hoc-integration-session.md) | [Meeting register](README.md) | Next: [MTG-13](2026-09-17-ad-hoc-stage-2-finalisation.md)
