"""tienda propia del vendedor: URL amigable, logo, portada y descripción larga

Revision ID: c8e4a1f7b3d2
Revises: b3e6f9a2c5d8
Create Date: 2026-09-24 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c8e4a1f7b3d2'
down_revision: Union[str, Sequence[str], None] = 'b3e6f9a2c5d8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = [
    ('shop_slug', lambda: sa.Column('shop_slug', sa.String(50), nullable=True)),
    ('shop_logo_url', lambda: sa.Column('shop_logo_url', sa.String(500), nullable=True)),
    ('shop_cover_url', lambda: sa.Column('shop_cover_url', sa.String(500), nullable=True)),
    ('shop_long_description', lambda: sa.Column('shop_long_description', sa.Text(), nullable=True)),
]
INDEX_NAME = 'ix_seller_profiles_shop_slug'


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'seller_profiles' not in inspector.get_table_names():
        return
    existing = {col['name'] for col in inspector.get_columns('seller_profiles')}
    for name, make in COLUMNS:
        if name not in existing:
            op.add_column('seller_profiles', make())
    indexes = {ix['name'] for ix in inspector.get_indexes('seller_profiles')}
    if INDEX_NAME not in indexes:
        # Único: dos tiendas no pueden compartir dirección (los NULL no chocan entre sí).
        op.create_index(INDEX_NAME, 'seller_profiles', ['shop_slug'], unique=True)


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name='seller_profiles')
    for name, _ in reversed(COLUMNS):
        op.drop_column('seller_profiles', name)
