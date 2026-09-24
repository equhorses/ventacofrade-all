"""cuenta de super admin con todas las ventajas de serie

Da acceso gratuito hasta 2099 (= plan Profesional completo) a los perfiles de
vendedor de las cuentas con rol "admin". Las cuentas admin que creen su perfil
más adelante lo reciben automáticamente (routers/seller_profiles.py).

Revision ID: a2d8e5f1c9b3
Revises: f1c7d3a9b5e2
Create Date: 2026-09-24 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'a2d8e5f1c9b3'
down_revision: Union[str, Sequence[str], None] = 'f1c7d3a9b5e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE seller_profiles
        SET free_access_until = TIMESTAMPTZ '2099-12-31 00:00:00+00'
        WHERE user_id IN (SELECT id FROM users WHERE role = 'admin')
          AND (free_access_until IS NULL OR free_access_until < TIMESTAMPTZ '2099-12-31 00:00:00+00')
        """
    )


def downgrade() -> None:
    # No se deshace: no sabemos qué acceso tenía cada cuenta antes.
    pass
