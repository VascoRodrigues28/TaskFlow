from datetime import UTC, date, datetime, timedelta
from uuid import UUID

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models import DailyActivityRecord


def activity_day() -> date:
    return datetime.now(UTC).date()


def activity_window() -> tuple[date, date]:
    today = activity_day()
    previous_year = today.replace(
        year=today.year - 1,
        day=28 if (today.month, today.day) == (2, 29) else today.day,
    )
    return previous_year + timedelta(days=1), today


def record_contribution(session: Session, user_id: UUID) -> None:
    statement = (
        insert(DailyActivityRecord)
        .values(user_id=user_id, day=activity_day(), count=1)
        .on_conflict_do_update(
            index_elements=[DailyActivityRecord.user_id, DailyActivityRecord.day],
            set_={"count": DailyActivityRecord.count + 1},
        )
    )
    session.execute(statement)
