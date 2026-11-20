from sqlalchemy import select, union
from sqlalchemy.orm import Session

from models import NotificationRecord, ProjectInvitationRecord, ProjectRecord, TaskRecord, UserRecord
from schemas.notifications import NotificationKind


def record_task_activity(
    session: Session, task: TaskRecord, actor: UserRecord, kind: NotificationKind
) -> None:
    if task.project_id is None:
        return

    project = session.get(ProjectRecord, task.project_id)
    if project is None:
        return

    if task.id is None:
        session.flush()

    recipients = union(
        select(ProjectRecord.owner_id).where(ProjectRecord.id == project.id),
        select(ProjectInvitationRecord.member_id).where(
            ProjectInvitationRecord.project_id == project.id,
            ProjectInvitationRecord.member_id.is_not(None),
        ),
    )
    session.add_all(
        NotificationRecord(
            recipient_id=recipient_id,
            kind=kind,
            actor_email=actor.email,
            project_name=project.name,
            task_title=task.title,
            project_id=project.id,
            task_id=task.id,
        )
        for recipient_id in session.scalars(recipients)
        if recipient_id != actor.id
    )
