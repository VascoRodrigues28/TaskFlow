from datetime import date

from fastapi import APIRouter
from pydantic import BaseModel
from sqlalchemy import select

from activity import activity_window
from models import DailyActivityRecord
from routers.auth import CurrentUser, DatabaseSession

router = APIRouter(prefix="/activity", tags=["Atividade"])


class ContributionCalendar(BaseModel):
    start: date
    end: date
    days: dict[date, int]


@router.get("")
def list_activity(session: DatabaseSession, user: CurrentUser) -> ContributionCalendar:
    start, end = activity_window()
    statement = select(DailyActivityRecord.day, DailyActivityRecord.count).where(
        DailyActivityRecord.user_id == user.id,
        DailyActivityRecord.day.between(start, end),
    )
    return ContributionCalendar(
        start=start, end=end,
        days={day: count for day, count in session.execute(statement)},
    )
