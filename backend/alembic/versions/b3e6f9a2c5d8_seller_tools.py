"""herramientas del vendedor: contacto directo, modo vacaciones, subir anuncios e informe mensual

Revision ID: b3e6f9a2c5d8
Revises: d7a2b5e8f1c4
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b3e6f9a2c5d8'
down_revision: Union[str, Sequence[str], None] = 'd7a2b5e8f1c4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

SELLER_COLUMNS = [
    ('whatsapp', lambda: sa.Column('whatsapp', sa.String(20), nullable=True)),
    ('website', lambda: sa.Column('website', sa.String(300), nullable=True)),
    ('instagram', lambda: sa.Column('instagram', sa.String(300), nullable=True)),
    ('facebook', lambda: sa.Column('facebook', sa.String(300), nullable=True)),
    ('vacation_mode', lambda: sa.Column('vacation_mode', sa.Boolean(), nullable=True, server_default='false')),
    ('last_manual_bump_at', lambda: sa.Column('last_manual_bump_at', sa.DateTime(timezone=True), nullable=True)),
    ('last_report_month', lambda: sa.Column('last_report_month', sa.String(7), nullable=True)),
]
PRODUCT_COLUMNS = [
    ('bumped_at', lambda: sa.Column('bumped_at', sa.DateTime(timezone=True), nullable=True)),
    ('paused_by_vacation', lambda: sa.Column('paused_by_vacation', sa.Boolean(), nullable=True, server_default='false')),
]


def _add_missing(inspector, table, columns):
    if table not in inspector.get_table_names():
        return
    existing = {col['name'] for col in inspector.get_columns(table)}
    for name, make in columns:
        if name not in existing:
            op.add_column(table, make())


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    _add_missing(inspector, 'seller_profiles', SELLER_COLUMNS)
    _add_missing(inspector, 'products', PRODUCT_COLUMNS)


def downgrade() -> None:
    for name, _ in PRODUCT_COLUMNS:
        op.drop_column('products', name)
    for name, _ in SELLER_COLUMNS:
        op.drop_column('seller_profiles', name)
