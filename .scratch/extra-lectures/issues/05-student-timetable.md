# 05: Students see their Division's Extra Lectures on their timetable

**What to build:** A student sees their **Division**'s **Extra Lectures** on their timetable. Those in the current week appear in the Saturday-afternoon grid cells, and all of them appear in an **Upcoming Extra Lectures** list, with subject, faculty member, date, time and room. Cancelled ones are shown as cancelled. Other Divisions' Extra Lectures never appear. See `../spec.md` (Timetable responses).

**Blocked by:** 03 (A faculty member cancels an Extra Lecture)

**Status:** done (manual UI check pending)

- [x] The student timetable response includes an `extra_lectures` list for the student's own Division only, from the start of the current week onward, using the shared Extra Lecture response type.
- [x] Extra Lectures in the current week are placed in the grid through the shared grid-placement helper from ticket 02. Only the student timetable builder changes, not the helper.
- [x] Cancelled Extra Lectures are included, with their status.
- [x] The UI shows Extra Lectures in the grid labelled "Extra" with the date, plus an Upcoming list. Cancelled ones are struck through and labelled "Cancelled".
- [x] API tests: a student in Division A sees A's Extra Lectures and not B's, and a cancelled lecture appears with CANCELLED status. Tests live in their own file and use the Extra Lecture factory.
- [ ] Manually verified in the running app.
