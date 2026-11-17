# 04: Clash detection for Extra Lectures

**What to build:** When a faculty member tries to create an **Extra Lecture** that overlaps another, creation is blocked with a message naming the conflict. This applies when they already have an Extra Lecture overlapping that time on that date, and when the **Division** already has another faculty member's Extra Lecture then. Cancelled Extra Lectures don't count, so cancelling one frees its time. See `../spec.md` (Validation rules: teacher clash, Division clash).

**Blocked by:** 03 (A faculty member cancels an Extra Lecture)

**Status:** ready-for-agent

- [ ] Create is rejected when the same faculty member has a SCHEDULED Extra Lecture on that date whose time range overlaps. The message names the conflicting subject, time and Division.
- [ ] Create is rejected when the same Division has a SCHEDULED Extra Lecture (by any faculty member) on that date whose time range overlaps. The message names the conflicting subject, time and faculty member.
- [ ] Lectures that touch but don't overlap (e.g. 13:30–14:30 and 14:30–15:30) are allowed.
- [ ] CANCELLED Extra Lectures are ignored, so creating over a cancelled lecture's time succeeds.
- [ ] The form shows the clash message inline.
- [ ] API tests cover the teacher clash, the Division clash, touching ranges, and creating over a cancelled lecture. Tests live in their own file and use the Extra Lecture factory.
