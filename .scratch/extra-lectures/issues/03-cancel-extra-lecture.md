# 03: A faculty member cancels an Extra Lecture

**What to build:** A faculty member can cancel an **Extra Lecture** they created, from the Upcoming Extra Lectures list. The lecture stays visible on their timetable, marked as cancelled (struck through), until its date passes. Landing cancel before the student-facing tickets means each of them handles the cancelled state in its own slice. See `../spec.md` (Extra Lecture module: Cancel).

**Blocked by:** 02 (A faculty member creates an Extra Lecture and sees it on My Timetable)

**Status:** ready-for-agent

- [ ] The cancel endpoint sets the status to CANCELLED and records the time it was cancelled.
- [ ] Cancel succeeds for the owning faculty member and for an admin.
- [ ] Cancel is rejected with a clear 4xx when the caller is another faculty member, when the lecture is already cancelled, or when its date has passed.
- [ ] The "my Extra Lectures" endpoint and the faculty timetable response still include cancelled lectures, with their status.
- [ ] The UI shows a **Cancel** button (with confirmation) on scheduled, future Extra Lectures. Cancelled lectures are struck through and labelled "Cancelled" in both the grid and the list.
- [ ] API tests cover a successful cancel and each rejection.
- [ ] Manually verified in the running app.
