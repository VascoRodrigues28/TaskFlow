"""Add invitations and project membership."""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "project_invitations",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("member_id", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.UniqueConstraint("project_id", "email", name="uq_project_invitation_email"),
    )
    op.create_index("ix_project_invitations_email", "project_invitations", ["email"])
    op.create_index("ix_project_invitations_member_id", "project_invitations", ["member_id"])


def downgrade() -> None:
    op.drop_table("project_invitations")
