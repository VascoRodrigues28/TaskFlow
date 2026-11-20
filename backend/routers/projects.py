from uuid import UUID

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import delete, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from models import ProjectInvitationRecord, ProjectRecord, UserRecord
from routers.auth import CurrentUser, DatabaseSession
from schemas.projects import InviteToProject, PendingInvitation, Project, ProjectCreate, ProjectUpdate

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


@router.post("", status_code=status.HTTP_201_CREATED)
def create_project(payload: ProjectCreate, session: DatabaseSession, user: CurrentUser) -> Project:
    project = ProjectRecord(**payload.model_dump(), owner_id=user.id)
    session.add(project)
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
    statement = (
        delete(ProjectRecord)
        .where(ProjectRecord.id == project_id, ProjectRecord.owner_id == user.id)
        .returning(ProjectRecord.id)
    )
    if session.scalar(statement) is None:
        raise project_not_found()
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
