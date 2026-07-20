"""add social login columns

Revision ID: 0002_add_social_login
Revises:
Create Date: 2026-07-20

"""
from alembic import op
import sqlalchemy as sa

revision = '0002_add_social_login'
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Make password_hash nullable (social login users have no password)
    op.alter_column(
        'users', 'password_hash',
        existing_type=sa.String(255),
        nullable=True,
    )
    # Add auth_provider column
    op.add_column(
        'users',
        sa.Column('auth_provider', sa.String(20), nullable=False, server_default='local'),
    )


def downgrade() -> None:
    op.drop_column('users', 'auth_provider')
    op.alter_column(
        'users', 'password_hash',
        existing_type=sa.String(255),
        nullable=False,
    )
