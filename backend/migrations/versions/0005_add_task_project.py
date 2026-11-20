"""Allow tasks to be assigned to a project."""

import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("project_id", sa.Uuid(), nullable=True))
    op.create_foreign_key(
        "fk_tasks_project_id", "tasks", "projects", ["project_id"], ["id"], ondelete="SET NULL"
    )
    op.create_index("ix_tasks_project_id", "tasks", ["project_id"])


def downgrade() -> None:
    op.drop_index("ix_tasks_project_id", table_name="tasks")
    op.drop_constraint("fk_tasks_project_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "project_id")
