"""quitar la subida con IA: borrar el contador diario de fotos analizadas

Revision ID: f1c7d3a9b5e2
Revises: e5b9c2f8a3d1
Create Date: 2026-09-24 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'f1c7d3a9b5e2'
down_revision: Union[str, Sequence[str], None] = 'e5b9c2f8a3d1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = ['ai_usage_date', 'ai_photos_used']


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'seller_profiles' not in inspector.get_table_names():
        return
    existing = {col['name'] for col in inspector.get_columns('seller_profiles')}
    for name in COLUMNS:
        if name in existing:
            op.drop_column('seller_profiles', name)


def downgrade() -> None:
    op.add_column('seller_profiles', sa.Column('ai_usage_date', sa.String(10), nullable=True))
    op.add_column('seller_profiles', sa.Column('ai_photos_used', sa.Integer(), nullable=True, server_default='0'))
