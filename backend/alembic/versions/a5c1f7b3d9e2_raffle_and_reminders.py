"""raffle winner tracking + platform launch setting + renewal reminders

Revision ID: a5c1f7b3d9e2
Revises: f2a5c8e1b4d9
Create Date: 2026-08-25 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5c1f7b3d9e2'
down_revision: Union[str, Sequence[str], None] = 'f2a5c8e1b4d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # --- invitations: track raffle-sourced invites and their real activation date ---
    existing_invitation_cols = {c['name'] for c in inspector.get_columns('invitations')}

    if 'source' not in existing_invitation_cols:
        op.add_column('invitations', sa.Column('source', sa.String(length=30), nullable=True))
    if 'activated_at' not in existing_invitation_cols:
        op.add_column('invitations', sa.Column('activated_at', sa.DateTime(timezone=True), nullable=True))
    if 'deadline_reminder_sent_at' not in existing_invitation_cols:
        op.add_column('invitations', sa.Column('deadline_reminder_sent_at', sa.DateTime(timezone=True), nullable=True))
    if 'revoked_at' not in existing_invitation_cols:
        op.add_column('invitations', sa.Column('revoked_at', sa.DateTime(timezone=True), nullable=True))

    # --- platform_settings: single-row table, launch_at controls when raffle
    # winners' free-access clock actually starts counting ---
    if 'platform_settings' not in inspector.get_table_names():
        op.create_table(
            'platform_settings',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=False, nullable=False),
            sa.Column('launch_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
            sa.Column('updated_by', sa.String(), nullable=True),
        )

    # --- renewal_reminders_sent: dedup log so we email each renewal only once ---
    if 'renewal_reminders_sent' not in inspector.get_table_names():
        op.create_table(
            'renewal_reminders_sent',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True, nullable=False),
            sa.Column('seller_profile_id', sa.Integer(), nullable=False, index=True),
            sa.Column('subscription_end_date', sa.DateTime(timezone=True), nullable=False),
            sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        )


def downgrade() -> None:
    """Downgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'renewal_reminders_sent' in inspector.get_table_names():
        op.drop_table('renewal_reminders_sent')

    if 'platform_settings' in inspector.get_table_names():
        op.drop_table('platform_settings')

    existing_invitation_cols = {c['name'] for c in inspector.get_columns('invitations')}
    for col in ('revoked_at', 'deadline_reminder_sent_at', 'activated_at', 'source'):
        if col in existing_invitation_cols:
            op.drop_column('invitations', col)
