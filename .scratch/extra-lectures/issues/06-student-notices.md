# 06: Students get Extra Lecture notices in the notification bell

**What to build:** When an **Extra Lecture** is created for a student's **Division**, the student sees "Extra lecture added: <subject>, <date> <time>" in the notification bell. If it's cancelled, they see "Extra lecture cancelled: …" instead. Either notice links to their timetable and disappears once the lecture date has passed. Notices are derived from Extra Lectures, and no notification records are stored. See `../spec.md` (API contracts: student Extra Lecture notices; Frontend: Navbar).

**Blocked by:** 03 (A faculty member cancels an Extra Lecture)

**Status:** ready-for-agent

- [ ] A student-only notices endpoint returns one notice per Extra Lecture for the student's Division whose date is today or later. Each notice has type ADDED (scheduled) or CANCELLED, subject, date, start time and the Extra Lecture id.
- [ ] Nothing is returned for other Divisions' Extra Lectures or for lectures whose date has passed.
- [ ] Non-students are rejected.
- [ ] The Navbar polls the endpoint for students, alongside its existing checks, and shows each notice with a link to the timetable.
- [ ] API tests cover ADDED, CANCELLED, other-Division exclusion and past-date exclusion, using the overridable "today". Tests live in their own file and use the Extra Lecture factory.
- [ ] Manually verified in the running app.
