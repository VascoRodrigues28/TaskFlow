"""Track task assignees and derive the active status from assignment."""

import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("tasks", sa.Column("assignee_id", sa.Uuid(), nullable=True))
    op.create_foreign_key("fk_tasks_assignee_id", "tasks", "users", ["assignee_id"], ["id"])
    op.create_index("ix_tasks_assignee_id", "tasks", ["assignee_id"])
    op.execute("UPDATE tasks SET status = 'todo' WHERE status = 'progress'")
    op.create_check_constraint(
        "ck_tasks_assignment_status", "tasks",
        "status = 'done' OR (status = 'todo' AND assignee_id IS NULL) "
        "OR (status = 'progress' AND assignee_id IS NOT NULL)",
    )


def downgrade() -> None:
    op.drop_constraint("ck_tasks_assignment_status", "tasks", type_="check")
    op.drop_index("ix_tasks_assignee_id", table_name="tasks")
    op.drop_constraint("fk_tasks_assignee_id", "tasks", type_="foreignkey")
    op.drop_column("tasks", "assignee_id")
