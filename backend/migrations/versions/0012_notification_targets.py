"""Keep the target IDs of new activity notifications."""

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notifications", sa.Column("task_id", sa.Integer()))
    op.add_column("notifications", sa.Column("project_id", sa.Uuid()))


def downgrade() -> None:
    op.drop_column("notifications", "project_id")
    op.drop_column("notifications", "task_id")
