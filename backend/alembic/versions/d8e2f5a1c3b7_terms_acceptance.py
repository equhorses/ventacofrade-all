"""Aceptación de Términos y Aviso Legal en users

Revision ID: d8e2f5a1c3b7
Revises: c4f7a9d2e8b1
Create Date: 2026-10-02
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'd8e2f5a1c3b7'
down_revision: Union[str, Sequence[str], None] = 'c4f7a9d2e8b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # IF NOT EXISTS: el arranque de la app ya añade solo las columnas que falten.
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_version VARCHAR(20)")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMP WITH TIME ZONE")
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS terms_accepted_ip VARCHAR(64)")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_accepted_ip")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_accepted_at")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS terms_version")
