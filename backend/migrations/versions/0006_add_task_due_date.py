"""Add an optional due date to tasks."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("due_date", sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column("tasks", "due_date")
