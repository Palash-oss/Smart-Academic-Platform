# 09: Taking attendance for an Extra Lecture with the projector (TOTP)

**What to build:** A faculty member can run the existing rolling-code projector check-in for an **Extra Lecture**. The Extra Lecture id travels with the live session from start to finalize, and finalizing records attendance through the same Extra Lecture marking path as ticket 08: N sessions for N hours, exempt from the daily cap, and rejected when cancelled or already marked. See `../spec.md` (Implementation Decisions: Attendance).

**Blocked by:** 08 (Taking attendance for an Extra Lecture (manual marking))

**Status:** done (manual verification in running app pending)

- [ ] Starting a projector session can carry an Extra Lecture id. Starting is rejected when the Extra Lecture is cancelled, already marked, or not dated today.
- [ ] Finalizing a projector session that has an Extra Lecture id records attendance through the Extra Lecture marking path. Totals rise by N for an N-hour lecture, and attendance_marked becomes true.
- [ ] Projector sessions without an Extra Lecture id behave exactly as before.
- [ ] From the Extra Lecture card, the faculty member can choose the projector flow, which opens prefilled with the Extra Lecture context.
- [ ] API tests: start, check in a student, finalize, then assert the student's totals rose by N. Starting for a cancelled Extra Lecture is rejected.
- [ ] Manually verified in the running app.
