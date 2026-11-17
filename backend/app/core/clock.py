"""Single source of "today" for the application.

Application code must read the current date through ``today()`` instead of calling ``date.today()``, so tests
can pin the date with ``set_today``.
"""
from datetime import date
from typing import Optional

_override: Optional[date] = None


def today() -> date:
    """The current date, or the value pinned by ``set_today``."""
    return _override if _override is not None else date.today()


def set_today(value: Optional[date]) -> None:
    """Pin "today" to ``value``; pass ``None`` to go back to the real date. For tests."""
    global _override
    _override = value

