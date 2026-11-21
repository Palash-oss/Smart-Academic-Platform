# 08: Taking attendance for an Extra Lecture (manual marking)

**What to build:** On the day of an **Extra Lecture**, the faculty member clicks **Take attendance** on its card. The marking page opens prefilled with subject, **Division**, date and enrolled students. Submitting records attendance against the Extra Lecture: a lecture lasting N hours adds N classes to every enrolled student's total and N attended classes to each student marked present. Extra Lectures are exempt from the limit of 2 marked sessions per subject per day, which still applies to normal lectures. See `../spec.md` (Implementation Decisions: Attendance).

**Blocked by:** 03 (A faculty member cancels an Extra Lecture)

**Status:** done (manual UI check pending)

- [x] Marking can be submitted with an Extra Lecture id. It reuses the existing session-marking logic and records N lecture sessions for an N-hour lecture.
- [x] For a 2-hour Extra Lecture, each enrolled student's total classes for the subject rise by 2, and attended classes rise by 2 for students marked present. This is visible through the existing attendance endpoints (the student's own attendance and percentage).
- [x] Extra Lecture marking succeeds even when 2 normal sessions for that subject were already marked that day.
- [x] A third normal (non-Extra Lecture) session for the same subject on the same day is still rejected by the existing cap.
- [x] Marking is rejected with a clear 4xx when the Extra Lecture is cancelled, already marked, or not dated today, or when the caller isn't its owner (or an admin).
- [x] On success, the Extra Lecture's attendance_marked becomes true, and it's reflected in the "my Extra Lectures" endpoint.
- [x] The UI shows a **Take attendance** button on the Extra Lecture card only on its date, while it's scheduled and unmarked. The button opens the marking page with the Extra Lecture context prefilled.
- [x] API tests cover each criterion above. Tests live in their own file and use the Extra Lecture factory and the overridable "today".
- [ ] Manually verified in the running app.
