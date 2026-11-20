from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import func, select, update

from models import NotificationRecord
from routers.auth import CurrentUser, DatabaseSession
from schemas.notifications import Notification, NotificationFeed

router = APIRouter(prefix="/notifications", tags=["Notificações"])


@router.get("")
def list_notifications(session: DatabaseSession, user: CurrentUser) -> NotificationFeed:
    recipient = NotificationRecord.recipient_id == user.id
    unread = NotificationRecord.read_at.is_(None)
    items = session.scalars(
        select(NotificationRecord)
        .where(recipient)
        .order_by(unread.desc(), NotificationRecord.created_at.desc(), NotificationRecord.id)
        .limit(50)
    )
    unread_count = session.scalar(select(func.count()).select_from(NotificationRecord).where(recipient, unread))
    return NotificationFeed(
        items=[Notification.model_validate(item) for item in items],
        unread_count=unread_count or 0,
    )


@router.put("/{notification_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def mark_notification_read(notification_id: UUID, session: DatabaseSession, user: CurrentUser) -> Response:
    statement = (
        update(NotificationRecord)
        .where(NotificationRecord.id == notification_id, NotificationRecord.recipient_id == user.id)
        .values(read_at=func.coalesce(NotificationRecord.read_at, func.now()))
        .returning(NotificationRecord.id)
    )
    if session.scalar(statement) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notificação não encontrada.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
