"""autorizaciones para importar el catálogo de otra plataforma (catalog_import_consents)

Revision ID: c4f7a9d2e8b1
Revises: b9e3f6a2d4c1
Create Date: 2026-09-28 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c4f7a9d2e8b1'
down_revision: Union[str, Sequence[str], None] = 'b9e3f6a2d4c1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'catalog_import_consents' in inspector.get_table_names():
        return
    op.create_table(
        'catalog_import_consents',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('source_key', sa.String(255), nullable=False),
        sa.Column('source_url', sa.String(500), nullable=False),
        sa.Column('consent_text', sa.Text(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('requested_by_email', sa.String(255), nullable=True),
        sa.Column('message_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('accepted_ip', sa.String(100), nullable=True),
        sa.Column('accepted_user_agent', sa.String(500), nullable=True),
    )
    op.create_index('ix_catalog_import_consents_user_id', 'catalog_import_consents', ['user_id'])
    op.create_index('ix_catalog_import_consents_source_key', 'catalog_import_consents', ['source_key'])


def downgrade() -> None:
    op.drop_index('ix_catalog_import_consents_source_key', table_name='catalog_import_consents')
    op.drop_index('ix_catalog_import_consents_user_id', table_name='catalog_import_consents')
    op.drop_table('catalog_import_consents')
