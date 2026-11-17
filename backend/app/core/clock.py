"""Single source of "today" for the application.

Application code must read the current date through ``today()`` instead of calling ``date.today()``, so tests
can pin the date with ``set_today``. The real date is taken in the college's local time (IST, no DST) so a
server running in UTC still agrees with the college about which day it is.
"""
from datetime import date, datetime, timedelta, timezone
from typing import Optional

COLLEGE_TZ = timezone(timedelta(hours=5, minutes=30))

_override: Optional[date] = None


def today() -> date:
    """The current college-local date, or the value pinned by ``set_today``."""
    return _override if _override is not None else datetime.now(COLLEGE_TZ).date()


def set_today(value: Optional[date]) -> None:
    """Pin "today" to ``value``; pass ``None`` to go back to the real date. For tests."""
    global _override
    _override = value
