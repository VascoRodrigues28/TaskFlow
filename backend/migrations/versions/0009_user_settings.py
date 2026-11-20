"""Persist account preferences and credential versions."""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.Text(), server_default="", nullable=False))
    op.add_column("users", sa.Column("bio", sa.Text(), server_default="", nullable=False))
    op.add_column("users", sa.Column("theme", sa.Text(), server_default="dark", nullable=False))
    op.add_column("users", sa.Column("language", sa.Text(), server_default="pt", nullable=False))
    op.add_column("users", sa.Column("token_version", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    for name in ("token_version", "language", "theme", "bio", "display_name"):
        op.drop_column("users", name)
