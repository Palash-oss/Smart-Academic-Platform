# Spec: Extra Lectures

Status: ready-for-agent

## Problem Statement

A faculty member sometimes needs to take an additional lecture for a Division beyond the recurring weekly timetable, for example to catch up on the syllabus before an exam. There is no way to do this in the platform today. The teacher has to tell students through other channels, the lecture never appears on anyone's timetable, and there is no clean way to record attendance for it. The existing attendance flow even blocks a third session for the same subject on the same day.

## Solution

On the **My Timetable** page, a faculty member can click **Add Extra Lecture** and choose a Division they teach, one of their subjects for that Division, a future Saturday, one or more consecutive afternoon hours, and a room. The platform checks for clashes and then creates the Extra Lecture. These are the effects:

- The Extra Lecture appears on the teacher's timetable, on the student timetable of every student in that Division, and on the admin Master Timetable. In each grid it appears in the week it falls, and every view also lists upcoming Extra Lectures.
- Every student in the Division sees an "Extra lecture added" notice in the notification bell until the lecture has happened.
- The teacher can take attendance for it from the Extra Lecture card. Each hour counts as one class toward attendance totals.
- The teacher can cancel it. Cancelling marks the lecture cancelled everywhere and shows students a "cancelled" notice until the date passes.

## User Stories

### Creating

1. As a faculty member, I want an **Add Extra Lecture** button on My Timetable, so that I can schedule an additional lecture without leaving my timetable.
2. As a faculty member, I want to choose only from Divisions I already teach, so that I can't schedule a lecture for students I don't teach.
3. As a faculty member, I want to choose the subject from the subjects I teach that Division, so that students know what the lecture is for.
4. As a faculty member, I want the subject filled in automatically when I teach that Division only one subject, so that I don't have to make a pointless choice.
5. As a faculty member, I want to pick only a future Saturday, so that I can't schedule a lecture in the past or on a weekday.
6. As a faculty member, I want to choose from the standard afternoon hours (13:30, 14:30, 15:30, 16:30), so that the Extra Lecture lines up with the timetable grid and avoids the Saturday-morning Mini Project block.
7. As a faculty member, I want to select several back-to-back hours as one Extra Lecture, so that I can run a longer session such as 13:30–15:30.
8. As a faculty member, I want to be prevented from selecting hours that aren't back-to-back, so that one Extra Lecture is always one continuous session.
9. As a faculty member, I want the room filled in with the Division's usual room and editable, so that I can hold it somewhere else if needed.
10. As a faculty member, I want creation blocked, with an error naming the conflict, if I already have an Extra Lecture overlapping that time, so that I don't double-book myself.
11. As a faculty member, I want creation blocked, with an error naming the conflict, if that Division already has another faculty member's Extra Lecture overlapping that time, so that students aren't double-booked.
12. As a faculty member, I want confirmation once the Extra Lecture is created, so that I know students have been notified.

### Viewing

13. As a faculty member, I want my Extra Lecture to appear in the Saturday-afternoon cells of my timetable grid in the week it falls, so that I can see it alongside my regular lectures.
14. As a faculty member, I want an **Upcoming Extra Lectures** list on My Timetable, so that I can see Extra Lectures in later weeks that the weekly grid doesn't show.
15. As a faculty member, I want Extra Lectures to look visibly different from regular Timetable Slots (an "Extra" label and the date), so that I don't confuse one-offs with recurring lectures.
16. As a faculty member, I want cancelled Extra Lectures shown as cancelled rather than hidden until their date passes, so that I have an accurate record.
17. As a student, I want my Division's Extra Lectures to appear in my timetable grid in the week they fall, so that I know when to attend.
18. As a student, I want an **Upcoming Extra Lectures** list on my timetable, so that I can plan for future Saturdays.
19. As a student, I want to see the subject, faculty, date, time and room of each Extra Lecture, so that I know where to go and what it covers.
20. As a student, I want a cancelled Extra Lecture shown as cancelled, so that I don't turn up for it.
21. As a student, I don't want to see Extra Lectures for other Divisions, so that my timetable shows only what applies to me.
22. As an admin, I want the Master Timetable for a Division to show that week's Extra Lectures, so that the official grid reflects what is actually happening.

### Notifications

23. As a student, I want an "Extra lecture added" notice in the notification bell when an Extra Lecture is created for my Division, so that I find out without checking my timetable.
24. As a student, I want the notice to show the subject, date and start time, so that I understand it at a glance.
25. As a student, I want clicking the notice to take me to my timetable, so that I can see the details.
26. As a student, I want the notice to stay until the lecture has happened, so that I'm reminded until it's relevant.
27. As a student, I want a "Extra lecture cancelled" notice when an Extra Lecture for my Division is cancelled, so that I don't attend a cancelled lecture.
28. As a student, I want the notices to disappear once the lecture date has passed, so that my bell doesn't fill up with stale items.

### Cancelling

29. As a faculty member, I want to cancel an Extra Lecture I created, so that I can call it off if plans change.
30. As a faculty member, I want to be unable to cancel another faculty member's Extra Lecture, so that only the owner controls it.
31. As a faculty member, I want to be unable to cancel an Extra Lecture whose date has passed, so that the record of held lectures stays intact.
32. As a faculty member, I want a cancelled Extra Lecture to free up its time, so that I or another faculty member can schedule a different Extra Lecture then.
33. As a faculty member who wants to change the time, date or room, I want to cancel and create a new Extra Lecture, so that students get a clear "cancelled" notice and a new "added" notice instead of a confusing edit.

### Attendance

34. As a faculty member, I want a **Take attendance** button on an Extra Lecture card on its date, so that I can record attendance without re-entering details.
35. As a faculty member, I want the attendance flow (projector TOTP or manual marking) to open prefilled with the subject, Division, date and enrolled students, so that I can start immediately.
36. As a faculty member, I want a multi-hour Extra Lecture to count as one class per hour toward students' attendance totals, so that a 2-hour lecture is weighted like two lectures.
37. As a faculty member, I want Extra Lecture attendance exempt from the limit of 2 sessions per subject per day, so that a scheduled Extra Lecture can always be marked.
38. As a faculty member, I want the limit of 2 sessions per subject per day to still apply to normal lectures, so that the existing safeguard isn't weakened.
39. As a faculty member, I want to be unable to mark attendance for an Extra Lecture twice, so that students' totals aren't inflated.
40. As a faculty member, I want to be unable to take attendance for a cancelled Extra Lecture, so that a cancelled lecture never affects attendance.
41. As a student, I want Extra Lecture attendance reflected in my attendance percentage, so that attending it helps me meet the 75% requirement.

## Implementation Decisions

### Domain

- An **Extra Lecture** is a new concept, separate from **Timetable Slot**. A Timetable Slot recurs weekly by day of week. An Extra Lecture is a one-off on a calendar date. Extra Lectures are never stored as Timetable Slots and are never touched by timetable generation or by clearing the timetable.
- An Extra Lecture belongs to one faculty member, one **Division**, one course offering (the subject) and one academic term.

### Schema

- Add a new **extra_lectures** table with these fields: id, academic term, faculty, division, course offering, lecture date, start time, end time, room, status (`SCHEDULED` | `CANCELLED`), attendance-marked flag, and created, updated and cancelled timestamps.
- Times use the existing standard hour boundaries. The start must be one of 13:30, 14:30, 15:30 or 16:30, and the end must be a later boundary up to 17:30. Back-to-back hours are therefore implied by the range.
- The app creates tables at startup with no migration tool, so a new table is created automatically. **No columns are added to existing tables.**

### Validation rules (enforced server-side; the UI mirrors them)

- The caller has the FACULTY or ADMIN role.
- The Division is one the faculty member teaches, meaning they have at least one Timetable Slot for it in that term.
- The course offering is one the faculty member teaches for that Division in that term.
- The date is a Saturday strictly after today.
- The time range is valid as described in Schema.
- Teacher clash: there is no SCHEDULED Extra Lecture by the same faculty member on that date with an overlapping time range.
- Division clash: there is no SCHEDULED Extra Lecture for the same Division on that date with an overlapping time range.
- When a rule fails, the request is rejected with a 4xx error and a message that names the problem. For a clash, the message names the conflicting lecture's subject, time and faculty member.
- The default room is the room used most often in that Division's Timetable Slots for the term.

### Extra Lecture module

- A new module owns the Extra Lecture rules: create, cancel, the options the form can offer, and queries for the teacher, the Division, and the Division's notices. The API routes are thin wrappers around it.
- It provides these operations:
  - **Form options** for a faculty member and term: the Divisions they teach, each with its subjects (course offerings) and default room; the selectable hour boundaries; and the upcoming Saturdays.
  - **Create** with Division, course offering, date, start, end and room. Returns the created Extra Lecture or a validation error.
  - **Cancel** by id. Only the owning faculty member (or an admin) can cancel, and only while the lecture is SCHEDULED and its date has not passed.
  - **List for a faculty member** from a date onward, including cancelled lectures.
  - **List for a Division** from a date onward, including cancelled lectures.

### API contracts (new endpoints, under the existing timetable API)

- `GET` **extra-lecture form options**, faculty only, returns what the form can offer.
- `POST` **create Extra Lecture**, faculty only, returns 201 with the Extra Lecture.
- `POST` **cancel Extra Lecture** by id, faculty only (owner or admin).
- `GET` **my Extra Lectures**, faculty only, returns upcoming and recent Extra Lectures with status.
- `GET` **student Extra Lecture notices**, student only. Returns the notices for the student's Division: one per Extra Lecture whose date is today or later, of type `ADDED` (SCHEDULED) or `CANCELLED`, with subject, date, start time and Extra Lecture id. The Navbar polls this endpoint like the existing swap-request and attendance notices. **No notification records are stored.** Notices are derived from Extra Lectures and disappear once the date has passed.
- An Extra Lecture as the API returns it has these fields: id, subject name and code, faculty name, division name, date, start time, end time, room, status, attendance_marked, hours (end minus start, in whole hours).

### Timetable responses (existing endpoints, extended)

- The faculty timetable, student timetable and Master Timetable responses gain a list of **extra_lectures**: Extra Lectures (scheduled and cancelled) for that faculty member or Division from the start of the current week onward.
- The weekly grid places an Extra Lecture in the Saturday-afternoon cells only when its date falls in the current week. Later Extra Lectures appear only in the Upcoming list. The Saturday-morning Mini Project cell is unchanged.
- Grid cells for Extra Lectures carry a marker so the UI can label them "Extra" with the date and show cancelled ones struck through.
- For students, the list contains only the Extra Lectures for their own Division.

### Attendance

- Attendance for an Extra Lecture is marked against the Extra Lecture id. The flow reuses the existing session-marking logic, which records a lecture session and updates each student's attendance totals for the subject.
- A lecture lasting N hours records N lecture sessions, so each enrolled student's total classes rise by N, and attended classes rise by N for each student marked present.
- The 2-per-subject-per-day cap is skipped when the marking is for an Extra Lecture and still applies to all other marking.
- Marking is rejected when the Extra Lecture is cancelled or already marked, or when today isn't its date. On success the Extra Lecture's attendance-marked flag is set.
- The projector (TOTP) flow carries the Extra Lecture id from start to finalize, so finalizing goes through the same Extra Lecture marking path.

### Frontend

- **My Timetable (faculty):**
  - An **Add Extra Lecture** button opens a form for Division, subject, Saturday date, hour range and room, driven by the form-options endpoint. Server error messages are shown inline.
  - The grid shows this week's Extra Lectures.
  - An **Upcoming Extra Lectures** list shows the rest, each with **Cancel** while it's scheduled and in the future, and **Take attendance** on its date.
- **Student timetable:** shows this week's Extra Lectures in the grid and an Upcoming list, both with cancelled styling where it applies.
- **Admin Master Timetable:** shows that week's Extra Lectures for the selected Division.
- **Navbar:** for students, polls the notices endpoint and shows "Extra lecture added: <subject>, <date> <time>" or "Extra lecture cancelled: …", linking to the timetable.
- **Attendance pages:** accept a prefilled Extra Lecture context (id, subject, Division, date) and submit marking with the Extra Lecture id.

## Testing Decisions

- **One seam: the HTTP API.** Tests call the FastAPI app through an httpx client (ASGI transport) against a real Postgres test database. The models use Postgres UUIDs and pgvector, so SQLite isn't an option.
  - The test setup creates the schema in a throwaway database on the docker-compose Postgres and seeds a minimal world: one department, two Divisions, two faculty members with Timetable Slots, course offerings, and students in each Division.
  - Auth comes from real login tokens or a dependency override for the current user.
- A good test asserts only externally visible behaviour: status codes, response bodies, and the effects visible through other endpoints, such as the timetable responses, the notices endpoint, and students' attendance percentages. It never asserts on internal calls or query shapes.
- Behaviours to cover through the API:
  - Create succeeds for a valid request, and the Extra Lecture appears in the teacher's timetable response, in that Division's student timetable response, and in the Master Timetable for that Division and week. It does not appear for the other Division.
  - Each validation rule rejects the request with a clear message: wrong role, a Division not taught, a subject not taught, a non-Saturday date, a past date, an invalid time range, a teacher clash, and a Division clash.
  - Clashes ignore cancelled Extra Lectures.
  - Cancel works for the owner. It's rejected for another faculty member and for a lecture whose date has passed. After a cancel, the time is free again.
  - The student notices endpoint returns ADDED for a scheduled lecture and CANCELLED for a cancelled one, only for the student's own Division, and nothing once the date has passed.
  - Attendance marking for a 2-hour Extra Lecture raises students' total classes by 2 and is not blocked by the daily cap. The cap still blocks a third normal session. Marking twice is rejected, as is marking a cancelled lecture.
- Tests control dates through a test-overridable "today" so that "future Saturday" and "has passed" are deterministic.
- **Prior art:** the backend already has a pytest + pytest-asyncio suite, but it unit-tests the attendance service with a mocked session. These API tests are a new, higher-level pattern, and their shared fixtures (test database, seed data, authenticated clients) should be reusable by future features.
- The frontend has no test tooling. UI behaviour is verified manually against the running app.

## Out of Scope

- Extra Lectures on days other than Saturday, or on Saturday morning (overriding Mini Project).
- Targeting practical batches or elective sections. Only whole Divisions can be targeted.
- Editing an Extra Lecture. The teacher cancels and recreates it instead.
- A persistent notification store, read/unread state, notification history, email or push notifications.
- Recurring Extra Lectures.
- Room booking or room clash detection.
- Clash detection against Timetable Slots. Saturday afternoon has no Timetable Slots today. If that changes, this needs revisiting.
- Admin approval of Extra Lectures.
- Week navigation in the timetable grids.

## Further Notes

- Domain terms (**Extra Lecture**, **Timetable Slot**, **Division**) are defined in `GLOSSARY.md`. "Class" and "Form" in the original request mean **Division**.
- Exempting Extra Lectures from the daily attendance cap is deliberate. A scheduled Extra Lecture is pre-declared, so the abuse the cap guards against (unplanned extra markings) doesn't apply.
- The current week is computed in the college's local time zone, so that a lecture on Saturday is always placed in that week's grid.
