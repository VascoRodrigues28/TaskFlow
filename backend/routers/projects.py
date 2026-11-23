from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import case, delete, or_, select, union, update
from sqlalchemy.dialects.postgresql import insert

from activity import record_contribution
from models import ProjectInvitationRecord, ProjectRecord, TaskRecord, UserRecord
from routers.auth import CurrentUser, DatabaseSession
from schemas.projects import (
    InviteToProject, ManagedInvitation, ManagedMember, PendingInvitation, Project,
    ProjectCreate, ProjectMember, ProjectPeople, ProjectUpdate,
)

router = APIRouter(prefix="/projects", tags=["Projetos"])


def project_not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Projeto não encontrado.")


def project_access(user_id: UUID):
    membership = select(ProjectInvitationRecord.id).where(
        ProjectInvitationRecord.project_id == ProjectRecord.id,
        ProjectInvitationRecord.member_id == user_id,
    ).exists()
    return or_(ProjectRecord.owner_id == user_id, membership)


def project_response(record: ProjectRecord, user: UserRecord) -> Project:
    return Project(
        id=record.id,
        name=record.name,
        description=record.description,
        role="host" if record.owner_id == user.id else "member",
    )


def require_host(session: DatabaseSession, user: CurrentUser, project_id: UUID, *, lock: bool = False) -> None:
    statement = select(ProjectRecord.id).where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
    if lock:
        statement = statement.with_for_update()
    if session.scalar(statement) is None:
        raise project_not_found()


@router.get("")
def list_projects(session: DatabaseSession, user: CurrentUser) -> list[Project]:
    statement = select(ProjectRecord).where(project_access(user.id))
    records = session.scalars(statement.order_by(ProjectRecord.name, ProjectRecord.id))
    return [project_response(record, user) for record in records]


@router.get("/invitations")
def list_invitations(session: DatabaseSession, user: CurrentUser) -> list[PendingInvitation]:
    statement = (
        select(ProjectInvitationRecord.id, ProjectRecord.id, ProjectRecord.name)
        .join(ProjectRecord, ProjectRecord.id == ProjectInvitationRecord.project_id)
        .where(ProjectInvitationRecord.email == user.email, ProjectInvitationRecord.member_id.is_(None))
        .order_by(ProjectRecord.name, ProjectRecord.id)
    )
    return [
        PendingInvitation(id=invitation_id, project_id=project_id, project_name=name)
        for invitation_id, project_id, name in session.execute(statement)
    ]


@router.get("/members")
def list_project_members(session: DatabaseSession, user: CurrentUser) -> list[ProjectMember]:
    projects = (
        select(ProjectRecord.id, ProjectRecord.owner_id)
        .where(project_access(user.id))
        .cte("accessible_projects")
    )
    participants = union(
        select(projects.c.id.label("project_id"), projects.c.owner_id.label("user_id")),
        select(ProjectInvitationRecord.project_id, ProjectInvitationRecord.member_id)
        .join(projects, projects.c.id == ProjectInvitationRecord.project_id)
        .where(ProjectInvitationRecord.member_id.is_not(None)),
    ).subquery()
    statement = (
        select(participants.c.project_id, UserRecord)
        .join(UserRecord, UserRecord.id == participants.c.user_id)
        .order_by(UserRecord.display_name, UserRecord.email)
    )
    return [
        ProjectMember(project_id=project_id, id=member.id, name=member.display_name or member.email)
        for project_id, member in session.execute(statement)
    ]


@router.post("/invitations/{invitation_id}/accept", status_code=status.HTTP_204_NO_CONTENT)
def accept_invitation(invitation_id: UUID, session: DatabaseSession, user: CurrentUser) -> Response:
    statement = (
        update(ProjectInvitationRecord)
        .where(
            ProjectInvitationRecord.id == invitation_id,
            ProjectInvitationRecord.email == user.email,
            or_(ProjectInvitationRecord.member_id.is_(None), ProjectInvitationRecord.member_id == user.id),
        )
        .values(member_id=user.id)
        .returning(ProjectInvitationRecord.id)
    )
    if session.scalar(statement) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Convite não encontrado.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{project_id}/invitations", status_code=status.HTTP_204_NO_CONTENT)
def invite_to_project(
    project_id: UUID, payload: InviteToProject, session: DatabaseSession, user: CurrentUser
) -> Response:
    project = session.scalar(
        select(ProjectRecord.id)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .with_for_update(read=True, key_share=True)
    )
    if project is None:
        raise project_not_found()
    if payload.email.lower() == user.email:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já és o anfitrião deste projeto.")

    statement = (
        insert(ProjectInvitationRecord)
        .values(project_id=project_id, email=payload.email.lower())
        .on_conflict_do_nothing(constraint="uq_project_invitation_email")
        .returning(ProjectInvitationRecord.id)
    )
    if session.scalar(statement) is None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Já existe um convite para este email.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/{project_id}")
def get_project(project_id: UUID, session: DatabaseSession, user: CurrentUser) -> Project:
    project = session.scalar(
        select(ProjectRecord).where(ProjectRecord.id == project_id, project_access(user.id))
    )
    if project is None:
        raise project_not_found()
    return project_response(project, user)


@router.get("/{project_id}/people")
def get_project_people(project_id: UUID, session: DatabaseSession, user: CurrentUser) -> ProjectPeople:
    require_host(session, user, project_id)
    people = session.scalars(
        select(UserRecord)
        .join(ProjectInvitationRecord, ProjectInvitationRecord.member_id == UserRecord.id)
        .where(ProjectInvitationRecord.project_id == project_id, UserRecord.id != user.id)
        .order_by(UserRecord.display_name, UserRecord.email)
    ).unique()
    invitations = session.scalars(
        select(ProjectInvitationRecord)
        .where(ProjectInvitationRecord.project_id == project_id, ProjectInvitationRecord.member_id.is_(None))
        .order_by(ProjectInvitationRecord.email)
    )
    return ProjectPeople(
        members=[
            ManagedMember(id=user.id, name=user.display_name or user.email, email=user.email, role="host"),
            *(ManagedMember(id=person.id, name=person.display_name or person.email, email=person.email, role="member")
              for person in people),
        ],
        invitations=[ManagedInvitation(id=item.id, email=item.email) for item in invitations],
    )


@router.delete("/{project_id}/invitations/{invitation_id}", status_code=status.HTTP_204_NO_CONTENT)
def cancel_project_invitation(
    project_id: UUID, invitation_id: UUID, session: DatabaseSession, user: CurrentUser,
) -> Response:
    require_host(session, user, project_id, lock=True)
    statement = delete(ProjectInvitationRecord).where(
        ProjectInvitationRecord.project_id == project_id,
        ProjectInvitationRecord.id == invitation_id,
        ProjectInvitationRecord.member_id.is_(None),
    ).returning(ProjectInvitationRecord.id)
    if session.scalar(statement) is None:
        raise HTTPException(status_code=404, detail="Convite não encontrado.")
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{project_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_project_member(
    project_id: UUID, member_id: UUID, session: DatabaseSession, user: CurrentUser,
) -> Response:
    require_host(session, user, project_id, lock=True)
    statement = delete(ProjectInvitationRecord).where(
        ProjectInvitationRecord.project_id == project_id,
        ProjectInvitationRecord.member_id == member_id,
        ProjectInvitationRecord.member_id != user.id,
    ).returning(ProjectInvitationRecord.id)
    if session.scalar(statement) is None:
        raise HTTPException(status_code=404, detail="Membro não encontrado.")
    session.execute(
        update(TaskRecord).where(TaskRecord.project_id == project_id, TaskRecord.assignee_id == member_id)
        .values(
            assignee_id=None,
            status=case((TaskRecord.status == "progress", "todo"), else_=TaskRecord.status),
        )
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: DatabaseSession, user: CurrentUser) -> Project:
    project = ProjectRecord(**payload.model_dump(), owner_id=user.id)
    session.add(project)
    record_contribution(session, user.id)
    session.commit()
    return Project.model_validate(project)


@router.put("/{project_id}")
def update_project(
    project_id: UUID, payload: ProjectUpdate, session: DatabaseSession, user: CurrentUser
) -> Project:
    statement = (
        update(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .values(**payload.model_dump())
        .returning(ProjectRecord)
    )
    project = session.scalar(statement)
    if project is None:
        raise project_not_found()
    session.commit()
    return Project.model_validate(project)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: UUID, session: DatabaseSession, user: CurrentUser) -> Response:
    project = session.scalar(
        select(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .with_for_update()
    )
    if project is None:
        raise project_not_found()
    different_owner = TaskRecord.assignee_id.is_distinct_from(TaskRecord.owner_id)
    session.execute(
        update(TaskRecord).where(TaskRecord.project_id == project_id).values(
            assignee_id=case((different_owner, None), else_=TaskRecord.assignee_id),
            status=case((different_owner & (TaskRecord.status == "progress"), "todo"), else_=TaskRecord.status),
        )
    )
    session.delete(project)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
