# 01: API test harness against a real Postgres

**What to build:** A reusable way to test the backend through its HTTP API against a real Postgres database, so every Extra Lecture ticket can verify behaviour end to end. This is a prefactor. It ships no user-facing behaviour, only the seam the rest of the feature is tested at. See `../spec.md` (Testing Decisions).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tests call the FastAPI app through an httpx client (ASGI transport). No running server is needed.
- [ ] Each test run creates its own uniquely named throwaway database on the docker-compose Postgres, builds the schema in it, and drops it afterwards. Parallel runs, such as agents in separate worktrees, never share a database.
- [ ] A minimal seed world is available as fixtures: one department, two **Divisions** (A and B), two faculty members, each with **Timetable Slots** and course offerings for at least one Division, and a few students in each Division.
- [ ] Authenticated clients are available for a faculty member, a student in each Division, and an admin.
- [ ] Tests can override "today", so date rules like "future Saturday" and "has passed" are deterministic. The application code reads the current date through this single overridable source.
- [ ] A factory fixture can create an **Extra Lecture** directly in the database, with sensible defaults and overridable fields. Later tickets use it to set up state without going through the API. If the table doesn't exist yet, the factory lands with ticket 02.
- [ ] One smoke test hits an existing timetable endpoint, such as the faculty timetable, and passes.
- [ ] The existing attendance unit tests still pass.
- [ ] How to run the API tests locally (Postgres must be up) is documented briefly where developers will find it.
