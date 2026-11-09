"""evidence_analysis column on incident_reports (Phase 3)

Revision ID: a3f1b2c4d5e6
Revises: 9974fb9d202a
Create Date: 2026-11-09
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "a3f1b2c4d5e6"
down_revision: Union[str, None] = "9974fb9d202a"
branch_labels: Union[Sequence[str], None] = None
depends_on: Union[Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "incident_reports",
        sa.Column("evidence_analysis", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("incident_reports", "evidence_analysis")
