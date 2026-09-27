"""registro de atascos (user_events) y regalo a todos: Fundador + 12 meses de Profesional

- Crea la tabla user_events.
- A cada usuario (no staff) sin perfil de vendedor le crea uno básico.
- Marca a todos los vendedores como Fundador y les da 12 meses de acceso gratis
  (= plan Profesional), sin recortar a quien ya tuviera más.
- Las invitaciones pendientes pasan a 12 meses, para que quien se registre ahora también lo reciba.

Revision ID: b9e3f6a2d4c1
Revises: a2d8e5f1c9b3
Create Date: 2026-09-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b9e3f6a2d4c1'
down_revision: Union[str, Sequence[str], None] = 'a2d8e5f1c9b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if 'user_events' not in inspector.get_table_names():
        op.create_table(
            'user_events',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('user_id', sa.String(), nullable=True),
            sa.Column('email', sa.String(255), nullable=True),
            sa.Column('kind', sa.String(50), nullable=False),
            sa.Column('detail', sa.Text(), nullable=True),
            sa.Column('path', sa.String(255), nullable=True),
            sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index('ix_user_events_user_id', 'user_events', ['user_id'])
        op.create_index('ix_user_events_email', 'user_events', ['email'])
        op.create_index('ix_user_events_kind', 'user_events', ['kind'])
        op.create_index('ix_user_events_created_at', 'user_events', ['created_at'])

    # Perfil de vendedor para quien no lo tenga (el regalo va en el perfil).
    op.execute(
        """
        INSERT INTO seller_profiles (user_id, shop_name, province, is_active, subscription_status, created_at, updated_at)
        SELECT u.id, LEFT(COALESCE(NULLIF(u.name, ''), split_part(u.email, '@', 1)), 200), '', false, 'inactive', now(), now()
        FROM users u
        WHERE u.role = 'user'
          AND NOT EXISTS (SELECT 1 FROM seller_profiles s WHERE s.user_id = u.id)
        """
    )
    # Fundador + 12 meses de Profesional para todos.
    op.execute(
        """
        UPDATE seller_profiles
        SET is_founder = true,
            free_access_until = GREATEST(COALESCE(free_access_until, now()), now() + interval '365 days')
        WHERE user_id IN (SELECT id FROM users WHERE role = 'user')
        """
    )
    op.execute("UPDATE invitations SET months = 12 WHERE status = 'pending' AND months < 12")


def downgrade() -> None:
    op.drop_table('user_events')
