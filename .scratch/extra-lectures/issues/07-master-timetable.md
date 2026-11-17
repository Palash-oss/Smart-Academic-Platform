# 07: The admin Master Timetable shows Extra Lectures

**What to build:** On the Master Timetable, an admin viewing a **Division** sees that week's **Extra Lectures** for that Division in the Saturday-afternoon cells, with cancelled ones shown as cancelled. See `../spec.md` (Timetable responses).

**Blocked by:** 03 (A faculty member cancels an Extra Lecture)

**Status:** done (manual UI check pending)

- [x] The Master Timetable response for a Division includes an `extra_lectures` list for that Division, using the shared Extra Lecture response type.
- [x] That week's Extra Lectures are placed in the grid through the shared grid-placement helper from ticket 02. Only the Master Timetable builder changes, not the helper.
- [x] The rest of the official grid (Mini Project block, breaks, legends) is unchanged.
- [x] The UI shows Extra Lectures in the grid labelled "Extra" with the date. Cancelled ones are struck through.
- [x] API tests: the Master Timetable for Division A includes A's Extra Lectures this week and excludes B's. Tests live in their own file and use the Extra Lecture factory.
- [ ] Manually verified in the running app.
