"""Associate tasks with users and preserve existing unassigned tasks."""

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("owner_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_tasks_owner_id", "tasks", "users", ["owner_id"], ["id"])
    op.create_index("ix_tasks_owner_id", "tasks", ["owner_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_owner_id", table_name="tasks")
    op.drop_constraint("fk_tasks_owner_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "owner_id")
