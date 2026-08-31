"""fix age_confirmed_at to include timezone

The previous migration (c7f4a2e9b1d6) declared this column as
TIMESTAMP WITH TIME ZONE, but it ended up created as a plain
"timestamp without time zone" on Railway's Postgres. The column is still
empty at this point (no rows have a value yet), so this is a safe,
lossless correction rather than a real data migration.

Revision ID: d4b8e1f6c3a9
Revises: c7f4a2e9b1d6
Create Date: 2026-08-31 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd4b8e1f6c3a9'
down_revision: Union[str, Sequence[str], None] = 'c7f4a2e9b1d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' not in inspector.get_table_names():
        return

    columns = {col['name']: col for col in inspector.get_columns('users')}
    col = columns.get('age_confirmed_at')
    if col is None:
        # Column doesn't exist yet for some reason — create it correctly.
        op.add_column(
            'users',
            sa.Column('age_confirmed_at', sa.DateTime(timezone=True), nullable=True),
        )
        return

    # SQLAlchemy reports timezone-awareness via the reflected type's
    # `.timezone` attribute when available.
    already_aware = getattr(col.get('type'), 'timezone', False)
    if not already_aware:
        op.alter_column(
            'users',
            'age_confirmed_at',
            type_=sa.DateTime(timezone=True),
            postgresql_using="age_confirmed_at AT TIME ZONE 'UTC'",
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' not in inspector.get_table_names():
        return
    existing_columns = {col['name'] for col in inspector.get_columns('users')}
    if 'age_confirmed_at' in existing_columns:
        op.alter_column(
            'users',
            'age_confirmed_at',
            type_=sa.DateTime(timezone=False),
        )
