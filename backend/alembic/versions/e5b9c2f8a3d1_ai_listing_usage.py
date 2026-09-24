"""subida con IA: contador diario de fotos analizadas por vendedor

Revision ID: e5b9c2f8a3d1
Revises: c8e4a1f7b3d2
Create Date: 2026-09-24 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e5b9c2f8a3d1'
down_revision: Union[str, Sequence[str], None] = 'c8e4a1f7b3d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('ai_usage_date', lambda: sa.Column('ai_usage_date', sa.String(10), nullable=True)),
    ('ai_photos_used', lambda: sa.Column('ai_photos_used', sa.Integer(), nullable=True, server_default='0')),
]


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'seller_profiles' not in inspector.get_table_names():
        return
    existing = {col['name'] for col in inspector.get_columns('seller_profiles')}
    for name, make in COLUMNS:
        if name not in existing:
            op.add_column('seller_profiles', make())


def downgrade() -> None:
    for name, _ in reversed(COLUMNS):
        op.drop_column('seller_profiles', name)
