# 02: A faculty member creates an Extra Lecture and sees it on My Timetable

**What to build:** On **My Timetable**, a faculty member clicks **Add Extra Lecture** and chooses a **Division** they teach, one of their subjects for that Division, a future Saturday, a back-to-back range of afternoon hours, and a room prefilled with the Division's usual room. The **Extra Lecture** is created, appears in the Saturday-afternoon cells of their grid in the week it falls, and appears in an **Upcoming Extra Lectures** list. This is the tracer bullet: it introduces the table, the Extra Lecture module, the endpoints and the UI that later tickets extend. See `../spec.md` (Implementation Decisions: Domain, Schema, Validation rules, Extra Lecture module, API contracts, Timetable responses).

**Blocked by:** 01 (API test harness against a real Postgres)

**Status:** ready-for-agent

- [ ] A new extra lectures table exists, with the fields listed in the spec (including status and an attendance-marked flag). No existing table is altered.
- [ ] The form-options endpoint returns, for the logged-in faculty member and term: the Divisions they teach, each with its subjects and default room (the room used most often in that Division's Timetable Slots); the selectable hour boundaries 13:30, 14:30, 15:30, 16:30 and 17:30; and the upcoming Saturdays.
- [ ] The create endpoint returns 201 with the Extra Lecture for a valid request.
- [ ] Create is rejected with a 4xx and a clear message for each of these: a non-faculty caller, a Division not taught, a subject not taught for that Division, a non-Saturday date, a date that isn't after today, and an invalid time range (start not in the allowed set, end not a later boundary, or end after 17:30).
- [ ] The "my Extra Lectures" endpoint returns the faculty member's Extra Lectures from today onward.
- [ ] The faculty timetable response includes an `extra_lectures` list (from the start of the current week onward). Extra Lectures in the current week are placed in the Saturday-afternoon grid cells with an "extra" marker. The Saturday-morning Mini Project cell is unchanged.
- [ ] There is **one shared Extra Lecture response type**, used by every endpoint and timetable response that returns Extra Lectures. Its fields are id, subject name and code, faculty name, division name, date, start, end, room, status, attendance_marked and hours.
- [ ] There is **one shared helper that places Extra Lectures into a weekly grid**, given a list of Extra Lectures and the current week. It is written so the student timetable (ticket 05) and the Master Timetable (ticket 07) can reuse it unchanged.
- [ ] Extra Lectures are not removed by clearing the timetable or by regenerating it.
- [ ] The UI has an **Add Extra Lecture** button that opens a form driven by form options. The subject is auto-selected when there's only one, the room is prefilled and editable, only back-to-back hours can be selected, and server errors appear inline.
- [ ] The UI shows this week's Extra Lectures in the grid, labelled "Extra" with the date, and an **Upcoming Extra Lectures** list.
- [ ] API tests cover the success path, appearance in the faculty timetable response, and every rejection above.
- [ ] Manually verified in the running app.
