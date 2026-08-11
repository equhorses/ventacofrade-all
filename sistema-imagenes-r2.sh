#!/usr/bin/env bash
set -e
echo "Aplicando sistema de imagenes real (Cloudflare R2) + avatar..."

rm -f "backend/schemas/storage.py"
echo "  - backend/schemas/storage.py eliminado (ya no se usa)"

mkdir -p "$(dirname "backend/requirements.txt")"
cat > "backend/requirements.txt" << 'CLAUDE_PATCH_EOF_r2img'
fastapi>=0.110.0
uvicorn[standard]>=0.29.0
pydantic[email]>=2.11.0,<3.0.0
pydantic-settings>=2.8.1,<3.0.0
python-dotenv>=1.0.0
dotenv>=0.9.9
python-multipart>=0.0.6  # Required for FastAPI Form data handling

# Development and testing
pytest>=8.4.1
pytest-asyncio>=1.1.0
httpx>=0.27.0

# ASW Lambda
mangum==0.19.0

# Crypto
cryptography


# database module dependencies
sqlalchemy>=2.0.0
asyncpg>=0.29.0
alembic>=1.13.0
aiosqlite>=0.20.0
greenlet

# auth module dependencies
python-jose[cryptography]>=3.3.0

# aihub module dependencies
openai==2.16.0
sse-starlette>=1.6.0
PyMuPDF

# payment module dependencies
stripe>=12.0.0

# storage module dependencies (Cloudflare R2, S3-compatible)
boto3>=1.34.0
CLAUDE_PATCH_EOF_r2img
echo "  - backend/requirements.txt OK"

mkdir -p "$(dirname "backend/services/storage.py")"
cat > "backend/services/storage.py" << 'CLAUDE_PATCH_EOF_r2img'
"""Storage service backed by Cloudflare R2 (S3-compatible object storage).

Replaces the previous proxy to Atoms' internal OSS infrastructure, which is
no longer available. Configure via environment variables:

  R2_ACCOUNT_ID       - Cloudflare account ID
  R2_ACCESS_KEY_ID    - R2 API token access key
  R2_SECRET_ACCESS_KEY- R2 API token secret key
  R2_BUCKET_NAME      - Name of the R2 bucket to store files in
  R2_PUBLIC_URL       - Public base URL for the bucket (r2.dev URL or custom
                         domain), WITHOUT a trailing slash, e.g.
                         "https://pub-xxxxxxxx.r2.dev" or
                         "https://cdn.ventacofrade.com"
"""

import logging
import mimetypes
import uuid

import boto3
from botocore.client import Config as BotoConfig
from core.config import settings

logger = logging.getLogger(__name__)

ALLOWED_CONTENT_TYPES = {
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
}

ALLOWED_FOLDERS = {"products", "avatars"}

MAX_UPLOAD_URL_EXPIRY_SECONDS = 300  # 5 minutes


class StorageNotConfiguredError(RuntimeError):
    """Raised when R2 environment variables are missing."""


class StorageService:
    """Generates presigned upload URLs for Cloudflare R2."""

    def __init__(self):
        account_id = getattr(settings, "r2_account_id", None)
        access_key = getattr(settings, "r2_access_key_id", None)
        secret_key = getattr(settings, "r2_secret_access_key", None)
        self.bucket_name = getattr(settings, "r2_bucket_name", None)
        self.public_url = getattr(settings, "r2_public_url", None)

        if not all([account_id, access_key, secret_key, self.bucket_name, self.public_url]):
            raise StorageNotConfiguredError(
                "R2 storage is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, "
                "R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME and R2_PUBLIC_URL."
            )

        self.public_url = self.public_url.rstrip("/")

        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=BotoConfig(signature_version="s3v4"),
            region_name="auto",
        )

    def create_upload(self, filename: str, content_type: str, folder: str, user_id: str) -> dict:
        """
        Create a presigned URL the client can PUT a file to directly, plus
        the resulting public URL where the file will be accessible.
        """
        if folder not in ALLOWED_FOLDERS:
            raise ValueError(f"Invalid folder '{folder}'. Must be one of {sorted(ALLOWED_FOLDERS)}.")

        if content_type not in ALLOWED_CONTENT_TYPES:
            raise ValueError("Only image uploads are allowed (JPEG, PNG, WEBP, GIF).")

        extension = mimetypes.guess_extension(content_type) or ""
        if extension == ".jpe":
            extension = ".jpg"

        key = f"{folder}/{user_id}/{uuid.uuid4().hex}{extension}"

        try:
            upload_url = self.client.generate_presigned_url(
                ClientMethod="put_object",
                Params={
                    "Bucket": self.bucket_name,
                    "Key": key,
                    "ContentType": content_type,
                },
                ExpiresIn=MAX_UPLOAD_URL_EXPIRY_SECONDS,
            )
        except Exception as e:
            logger.error(f"Failed to generate presigned upload URL: {e}")
            raise

        return {
            "upload_url": upload_url,
            "public_url": f"{self.public_url}/{key}",
            "key": key,
        }
CLAUDE_PATCH_EOF_r2img
echo "  - backend/services/storage.py OK"

mkdir -p "$(dirname "backend/routers/storage.py")"
cat > "backend/routers/storage.py" << 'CLAUDE_PATCH_EOF_r2img'
import logging

from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.storage import StorageNotConfiguredError, StorageService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/storage", tags=["storage"])


class PresignedUploadRequest(BaseModel):
    filename: str
    content_type: str
    folder: str  # "products" | "avatars"


class PresignedUploadResponse(BaseModel):
    upload_url: str
    public_url: str
    key: str


@router.post("/presigned-upload", response_model=PresignedUploadResponse)
async def create_presigned_upload(
    request: PresignedUploadRequest,
    current_user: UserResponse = Depends(get_current_user),
):
    """
    Get a presigned URL for uploading an image directly to Cloudflare R2.

    Steps:
    1. Client calls this endpoint with the file's name/type and destination folder
    2. Server validates and returns a short-lived presigned PUT URL
    3. Client uploads the file directly to R2 using that URL (PUT request)
    4. The file is then accessible at the returned public_url
    """
    try:
        service = StorageService()
        result = service.create_upload(
            filename=request.filename,
            content_type=request.content_type,
            folder=request.folder,
            user_id=str(current_user.id),
        )
        return PresignedUploadResponse(**result)
    except StorageNotConfiguredError as e:
        logger.error(f"Storage not configured: {e}")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="La subida de imágenes no está disponible todavía. Inténtalo más tarde.",
        )
    except ValueError as e:
        logger.error(f"Invalid upload request: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Failed to generate upload URL: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="No se pudo preparar la subida.")
CLAUDE_PATCH_EOF_r2img
echo "  - backend/routers/storage.py OK"

mkdir -p "$(dirname "backend/models/auth.py")"
cat > "backend/models/auth.py" << 'CLAUDE_PATCH_EOF_r2img'
from models.base import Base
from sqlalchemy import Column, DateTime, Integer, String
from sqlalchemy.sql import func


class User(Base):
    __tablename__ = "users"

    id = Column(String(255), primary_key=True, index=True)  # Use platform sub as primary key
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=True)  # Null for legacy OIDC-created accounts
    name = Column(String(255), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    role = Column(String(50), default="user", nullable=False)  # user/admin
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
CLAUDE_PATCH_EOF_r2img
echo "  - backend/models/auth.py OK"

mkdir -p "$(dirname "backend/schemas/auth.py")"
cat > "backend/schemas/auth.py" << 'CLAUDE_PATCH_EOF_r2img'
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    id: str  # Now a string UUID (platform sub)
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: str = "user"  # user/admin
    last_login: Optional[datetime] = None

    class Config:
        from_attributes = True


class PlatformTokenExchangeRequest(BaseModel):
    """Request body for exchanging Platform token for app token."""

    platform_token: str


class TokenExchangeResponse(BaseModel):
    """Response body for issued application token."""

    token: str


class RegisterRequest(BaseModel):
    """Request body to create a new account with email + password."""

    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: Optional[str] = None


class LoginRequest(BaseModel):
    """Request body to log in with email + password."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class AuthTokenResponse(BaseModel):
    """Response returned after successful register/login."""

    token: str
    token_type: str = "Bearer"
    user: UserResponse
CLAUDE_PATCH_EOF_r2img
echo "  - backend/schemas/auth.py OK"

mkdir -p "$(dirname "backend/routers/user.py")"
cat > "backend/routers/user.py" << 'CLAUDE_PATCH_EOF_r2img'
from typing import Optional

from core.database import get_db
from dependencies.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException, status
from models.auth import User
from pydantic import BaseModel
from schemas.auth import UserResponse
from services.user import UserService
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/v1/users", tags=["users"])


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None
    avatar_url: Optional[str] = None


@router.get("/profile", response_model=UserResponse)
async def get_profile(db: AsyncSession = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Get current user profile"""
    profile = await UserService.get_user_profile(db, current_user.id)
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile


@router.put("/profile", response_model=UserResponse)
async def update_profile(
    profile_data: UpdateProfileRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update current user profile"""
    profile = await UserService.update_user_profile(
        db, current_user.id, name=profile_data.name, avatar_url=profile_data.avatar_url
    )
    if not profile:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User profile not found")
    return profile
CLAUDE_PATCH_EOF_r2img
echo "  - backend/routers/user.py OK"

mkdir -p "$(dirname "backend/services/user.py")"
cat > "backend/services/user.py" << 'CLAUDE_PATCH_EOF_r2img'
import logging
import time
from typing import Optional

from models.auth import User
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)


class UserService:
    @staticmethod
    async def get_user_profile(db: AsyncSession, user_id: str) -> Optional[User]:
        """Get user profile by user ID."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting get_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(
            f"[DB_OP] Get user profile completed in {time.time() - start_time:.4f}s - found: {user is not None}"
        )
        return user

    @staticmethod
    async def update_user_profile(
        db: AsyncSession, user_id: str, name: Optional[str] = None, avatar_url: Optional[str] = None
    ) -> Optional[User]:
        """Update user profile."""
        start_time = time.time()
        logger.debug(f"[DB_OP] Starting update_user_profile - user_id: {user_id}")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        logger.debug(f"[DB_OP] User lookup completed in {time.time() - start_time:.4f}s - found: {user is not None}")

        if user:
            start_time_update = time.time()
            logger.debug("[DB_OP] Starting user profile update")
            if name is not None:
                user.name = name
            if avatar_url is not None:
                user.avatar_url = avatar_url
            await db.commit()
            await db.refresh(user)
            logger.debug(f"[DB_OP] User profile update completed in {time.time() - start_time_update:.4f}s")

        return user
CLAUDE_PATCH_EOF_r2img
echo "  - backend/services/user.py OK"

mkdir -p "$(dirname "backend/core/database.py")"
cat > "backend/core/database.py" << 'CLAUDE_PATCH_EOF_r2img'
import asyncio
import logging
import os
import re
import time
from pathlib import Path

from asyncpg.exceptions import (
    DuplicateTableError,
    UniqueViolationError,
)
from core.config import settings
from sqlalchemy import DDL, text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)


class Base(DeclarativeBase):
    pass


class DatabaseManager:
    def __init__(self):
        self.engine = None
        self._initialized = False
        self.async_session_maker = None
        self._init_lock = asyncio.Lock()  # Protect initialization process
        self._table_creation_lock = asyncio.Lock()  # Protect table creation process

    @staticmethod
    def _sanitize_query_params(url):
        """Remove query parameters that are incompatible with asyncpg.

        Some providers (e.g. Neon) may inject parameters like ``channel_binding``
        that are not supported by asyncpg and cause connection failures.
        """
        unsupported_params = {"channel_binding"}
        found = unsupported_params & set(url.query)
        if found:
            logger.warning(f"Removed unsupported database URL query params: {sorted(found)}")
            return url.set(query={k: v for k, v in url.query.items() if k not in unsupported_params})
        return url

    def _normalize_async_database_url(self, raw_url: str) -> str:
        """Ensure the database URL uses an async driver compatible with SQLAlchemy asyncio.

        This guards against env overrides like DATABASE_URL using sync drivers
        (e.g., sqlite:/// or postgresql://), which would otherwise load 'pysqlite' or
        other sync drivers and break async engine initialization.
        """
        try:
            url = make_url(raw_url)
        except Exception as e:
            # If parsing fails, fall back to original; engine creation will raise with details
            logger.error(f"Failed to parse database URL: {e}")
            return raw_url

        drivername = url.drivername or ""

        # Sanitize query params that are incompatible with asyncpg
        if "postgresql" in drivername or "postgres" in drivername:
            url = self._sanitize_query_params(url)

        # Already async drivers
        if "+aiosqlite" in drivername or "+asyncpg" in drivername or "+aiomysql" in drivername:
            normalized = url.render_as_string(hide_password=False)
            self._check_db_exist(normalized)
            return normalized

        # Map common sync schemes to async equivalents
        if drivername == "sqlite":
            url = url.set(drivername="sqlite+aiosqlite")
            self._check_db_exist(raw_url)
        elif drivername in ("postgresql", "postgres"):
            url = url.set(drivername="postgresql+asyncpg")
        elif drivername in ("mysql",):
            url = url.set(drivername="mysql+aiomysql")
        elif drivername in ("mariadb",):
            url = url.set(drivername="mariadb+aiomysql")
        else:
            # Leave unknown schemes as-is
            logger.warning(f"Unknown database driver: {drivername}")
            return raw_url

        normalized = url.render_as_string(hide_password=False)
        if normalized != raw_url:
            logger.warning("Adjusted database URL driver for async compatibility")
        return normalized

    @staticmethod
    def _check_db_exist(raw_url: str) -> bool:
        if "sqlite" not in raw_url:
            return True
        filename = raw_url.split(":///", 1)[1]
        found = Path(filename).exists()
        if found:
            logger.debug(f"Database exists:{filename}")
        else:
            logger.error(f"Database not found:{filename}")
        return found

    async def init_db(self):
        """Initialize database connection with thread safety"""
        logger.info("Starting database initialization...")

        async with self._init_lock:
            if self.engine is not None:
                logger.info("Database already initialized")
                return

        if not settings.database_url:
            logger.error("No database URL provided. DATABASE_URL environment variable must be set.")
            raise ValueError("DATABASE_URL environment variable is required")

        try:
            logger.info("Normalizing database URL for async compatibility...")
            database_url = self._normalize_async_database_url(settings.database_url)

            logger.info("Creating async database engine...")
            # Configure engine based on environment (Lambda vs non-Lambda)
            engine_kwargs = {
                "echo": settings.debug,
            }

            # Check if we're in a Lambda environment
            is_lambda = bool(
                os.environ.get("AWS_LAMBDA_FUNCTION_NAME")
                or os.environ.get("IS_LAMBDA", "").lower() in ("true", "1", "yes")
            )

            if is_lambda:
                # Lambda: Use NullPool to avoid connection state conflicts
                # NullPool creates a fresh connection for each request, avoiding "cannot switch to state" errors
                engine_kwargs["poolclass"] = NullPool
                # NullPool doesn't support pool_timeout, pool_size, max_overflow, pool_recycle, or pool_pre_ping
                # These parameters are only valid for QueuePool
                logger.info("Using NullPool for Lambda environment to avoid connection state conflicts")
            else:
                # Non-Lambda: Use QueuePool with connection pooling
                engine_kwargs["pool_pre_ping"] = True  # Verify connections before using them
                engine_kwargs["pool_size"] = 10  # Connection pool size
                engine_kwargs["max_overflow"] = 20  # Maximum overflow connections
                engine_kwargs["pool_recycle"] = 3600  # Connection recycle time (1 hour)
                engine_kwargs["pool_timeout"] = 30  # Connection acquisition timeout (30 seconds)
                logger.info("Using QueuePool with connection pooling for non-Lambda environment")

            self.engine = create_async_engine(database_url, **engine_kwargs)
            logger.info("Database engine created successfully")

            logger.info("Creating async session maker...")
            self.async_session_maker = async_sessionmaker(self.engine, class_=AsyncSession, expire_on_commit=False)
            logger.info("Async session maker created successfully")

            logger.info("Database connection initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}", exc_info=True)
            raise

    async def close_db(self):
        """Close database connection and dispose engine

        In Lambda environments, this ensures connections are cleanly closed
        before container freeze/reuse, avoiding "server closed the connection unexpectedly" errors.
        """
        if not self.engine:
            return  # Already closed

        try:
            await self.engine.dispose()
            logger.info("Database connection closed and engine disposed")
        except Exception as e:
            logger.warning(f"Error disposing database engine: {e}")
        finally:
            # Always reset references even if dispose fails
            self.engine = None
            self.async_session_maker = None
            self._initialized = False  # Reset initialization flag

    async def create_tables(self):
        """Create all tables with thread safety"""
        start_time = time.time()
        logger.debug("[DB_OP] Starting create_tables")
        await self._table_creation_lock.acquire()
        try:
            if self._initialized:
                logger.info("Tables already initialized")
                return

            if not self.engine:
                logger.error("Database engine not initialized")
                raise RuntimeError("Database engine not initialized")

            try:
                logger.info("🔧 Starting table creation...")
                async with self.engine.begin() as conn:
                    await conn.run_sync(Base.metadata.create_all)
                    self._initialized = True
                    logger.info("Tables initialized successfully")
                    logger.debug(f"[DB_OP] Create tables completed in {time.time() - start_time:.4f}s")
            except (UniqueViolationError, DuplicateTableError) as e:
                self._initialized = True
                logger.info(f"Duplicate table creation: {e}, ignored.")
            except Exception as e:
                logger.error(f"Failed to create tables: {e}")
                raise

            # After ensuring all tables exist, add any columns that are
            # present in the SQLAlchemy models but missing from the actual
            # database (e.g. a column added to a model after the table was
            # first created in production). This is additive-only (ALTER
            # TABLE ... ADD COLUMN) and safe to run on every startup.
            try:
                logger.info("🔧 Starting table structure repair...")
                await self.check_and_repair_existing_tables()
                logger.info("🔧 Table structure repair completed")
            except Exception as e:
                logger.warning(f"Table structure repair skipped due to error: {e}")
        finally:
            self._table_creation_lock.release()

    async def check_and_repair_existing_tables(self):
        """Check and fix the structure of existing tables, adding only the missing fields."""
        repair_start = time.time()

        try:
            existing_tables = await self._get_existing_tables()

            if not existing_tables:
                logger.info("No existing tables found, skipping repair")
                return

            model_tables = list(Base.metadata.tables.keys())
            tables_to_repair = [table for table in model_tables if table in existing_tables]

            if not tables_to_repair:
                logger.info("No existing tables need repair")
                return

            logger.info(f"🔧 Repairing {len(tables_to_repair)} existing tables...")

            semaphore = asyncio.Semaphore(10)

            async def repair_with_semaphore(table_name):
                start_time = time.time()
                async with semaphore:
                    await self._repair_table_structure(table_name)
                logger.info(f"Table {table_name} repaired in {time.time() - start_time:.2f}s")

            await asyncio.gather(
                *[repair_with_semaphore(table_name) for table_name in tables_to_repair], return_exceptions=True
            )

            logger.info(f"🔧 Table structure repair completed in {time.time() - repair_start:.4f}s")

        except Exception as e:
            logger.error(f"Failed to repair existing tables: {e}")

    def _escape_identifier(self, identifier: str, identifier_type: str = "identifier") -> str:
        """Validate and escape SQL identifier to prevent SQL injection."""
        if not re.match(r"^[a-zA-Z0-9_-]+$", identifier):
            raise ValueError(
                f"Invalid {identifier_type}: {identifier}. "
                "Only alphanumeric characters, underscores, and hyphens are allowed."
            )

        if not self.engine:
            logger.warning(f"Engine not initialized, returning unescaped {identifier_type}: {identifier}")
            return identifier

        return self.engine.dialect.identifier_preparer.quote(identifier)

    def _escape_table_name(self, table_name: str) -> str:
        """Validate and escape table name."""
        return self._escape_identifier(table_name, "table name")

    def _escape_column_name(self, column_name: str) -> str:
        """Validate and escape column name."""
        return self._escape_identifier(column_name, "column name")

    async def _get_existing_tables(self):
        """Fetch all existing table names at once."""
        try:
            if self.engine.dialect.name == "postgresql":
                query = text(
                    """
                             SELECT table_name
                             FROM information_schema.tables
                             WHERE table_schema = 'public'
                             """
                )
            elif self.engine.dialect.name == "sqlite":
                query = text("SELECT name FROM sqlite_master WHERE type='table'")
            else:
                # MySQL 等其他数据库
                query = text("SHOW TABLES")

            async with self.engine.begin() as conn:
                result = await conn.execute(query)
                return [row[0] for row in result.fetchall()]

        except Exception as e:
            logger.error(f"Failed to get existing tables: {e}")
            return []

    async def _repair_table_structure(self, table_name: str):
        """Repair the structure of a single table by adding only the missing fields."""
        try:
            logger.debug(f"Checking table structure for: {table_name}")

            existing_columns = await self._get_table_columns(table_name)
            model_columns = self._get_model_columns(table_name)
            missing_columns = self._find_missing_columns(existing_columns, model_columns)

            if missing_columns:
                logger.info(
                    f"Found {len(missing_columns)} missing columns in {table_name}: "
                    f"{[col['name'] for col in missing_columns]}"
                )
                await self._add_missing_columns(table_name, missing_columns)
            else:
                logger.debug(f"Table {table_name} structure is up to date")

        except Exception as e:
            logger.warning(f"Failed to repair table {table_name}: {e}")

    async def _add_missing_columns(self, table_name: str, missing_columns: list):
        """Batch add missing fields to improve efficiency.

        Security: All inputs are validated and escaped before SQL generation:
        - table_name: validated and escaped via _escape_table_name()
        - column_name: validated and escaped via _escape_column_name()
        - column_type: from _map_sqlalchemy_type() which only returns safe predefined types
        - default values: sanitized and validated before use
        """
        try:
            async with self.engine.begin() as conn:
                for column_info in missing_columns:
                    # Security: All inputs validated and escaped before DDL generation
                    alter_sql = self._generate_add_column_sql(table_name, column_info)
                    # Use DDL object instead of text() to avoid security scanner warnings
                    # All user inputs are already validated and escaped in _generate_add_column_sql
                    ddl = DDL(alter_sql)
                    await conn.execute(ddl)
                    logger.info(f"Added column {column_info['name']} to table {table_name}")

            logger.info(f"Successfully added {len(missing_columns)} columns to table {table_name}")

        except Exception as e:
            logger.error(f"Failed to add columns to table {table_name}: {e}")

    async def _get_table_columns(self, table_name: str):
        """Get existing table column information"""
        try:
            if self.engine.dialect.name == "postgresql":
                # Use parameterized query - build query string separately to avoid scanner warnings
                query_str = (
                    "SELECT column_name, data_type, is_nullable, column_default "
                    "FROM information_schema.columns "
                    "WHERE table_name = :table_name"
                )
                query = text(query_str)
            elif self.engine.dialect.name == "sqlite":
                # PRAGMA doesn't support quoted identifiers, validate only
                if not re.match(r"^[a-zA-Z0-9_-]+$", table_name):
                    raise ValueError(
                        f"Invalid table name: {table_name}. "
                        "Only alphanumeric characters, underscores, and hyphens are allowed."
                    )
                # Build SQL string separately to avoid f-string in text() call
                pragma_sql = "PRAGMA table_info(" + table_name + ")"
                query = text(pragma_sql)
            else:
                escaped_table_name = self._escape_table_name(table_name)
                # Build SQL string separately to avoid f-string in text() call
                describe_sql = "DESCRIBE " + escaped_table_name
                query = text(describe_sql)

            async with self.engine.begin() as conn:
                result = await conn.execute(
                    query, {"table_name": table_name} if self.engine.dialect.name == "postgresql" else {}
                )
                columns = []
                for row in result.fetchall():
                    if self.engine.dialect.name == "sqlite":
                        columns.append({"name": row[1], "type": row[2], "nullable": not row[3], "default": row[4]})
                    else:
                        columns.append({"name": row[0], "type": row[1], "nullable": row[2] == "YES", "default": row[3]})
                return columns
        except Exception as e:
            logger.error(f"Failed to get columns for table {table_name}: {e}")
            return []

    def _get_model_columns(self, table_name: str):
        """Get model-defined column information"""
        try:
            table = Base.metadata.tables[table_name]
            columns = []

            for column in table.columns:
                # Handle both default and server_default
                default_value = None
                if column.default is not None:
                    if hasattr(column.default, "arg"):
                        default_value = str(column.default.arg)
                    else:
                        default_value = str(column.default)
                elif column.server_default is not None:
                    if hasattr(column.server_default, "arg"):
                        default_value = str(column.server_default.arg)
                    else:
                        default_value = str(column.server_default)

                columns.append(
                    {
                        "name": column.name,
                        "type": self._map_sqlalchemy_type(column.type),
                        "nullable": column.nullable,
                        "default": default_value,
                    }
                )

            return columns
        except Exception as e:
            logger.error(f"Failed to get model columns for table {table_name}: {e}")
            return []

    def _map_sqlalchemy_type(self, sqlalchemy_type):
        """Map SQLAlchemy type to database-specific type"""
        type_name = str(sqlalchemy_type).lower()

        if "integer" in type_name:
            return "INTEGER"
        elif "string" in type_name or "varchar" in type_name:
            return "VARCHAR"
        elif "text" in type_name:
            return "TEXT"
        elif "datetime" in type_name:
            return "TIMESTAMP"
        elif "boolean" in type_name:
            return "BOOLEAN"
        else:
            return str(sqlalchemy_type)

    def _find_missing_columns(self, existing_columns, model_columns):
        """Find columns that exist in model but not in existing table"""
        existing_names = {col["name"] for col in existing_columns}
        missing = []

        for model_col in model_columns:
            if model_col["name"] not in existing_names:
                missing.append(model_col)

        return missing

    def _generate_add_column_sql(self, table_name: str, column_info: dict):
        """Generate ALTER TABLE ADD COLUMN SQL statement"""
        column_name = column_info["name"]
        column_type = column_info["type"]
        nullable = column_info["nullable"]
        default = column_info["default"]

        # Escape table and column names to prevent SQL injection
        escaped_table_name = self._escape_table_name(table_name)
        escaped_column_name = self._escape_column_name(column_name)

        sql = f"ALTER TABLE {escaped_table_name} ADD COLUMN {escaped_column_name} {column_type}"

        # If column is NOT NULL but has no default, make it nullable to avoid constraint violations
        if not nullable and default is None:
            # For existing tables with data, make the column nullable to avoid NOT NULL constraint violations
            logger.warning(
                f"Column {column_name} in table {table_name} is NOT NULL but has no default. "
                "Making it nullable to avoid constraint violations."
            )
            nullable = True

        if not nullable:
            sql += " NOT NULL"

        if default is not None:
            # Handle different data types for default values
            if default == "":
                if column_type.upper() in ["TEXT", "VARCHAR", "STRING"]:
                    sql += " DEFAULT ''"
                else:
                    # For non-text types with empty string default, use appropriate default
                    if column_type.upper() in ["INTEGER", "BIGINT"]:
                        sql += " DEFAULT 0"
                    elif column_type.upper() in ["BOOLEAN"]:
                        sql += " DEFAULT false"
                    else:
                        sql += " DEFAULT ''"
            else:
                # Quote string values for text types
                if column_type.upper() in ["TEXT", "VARCHAR", "STRING"] and not default.isdigit():
                    sql += f" DEFAULT '{default}'"
                else:
                    sql += f" DEFAULT {default}"
        logger.debug(f"ALTER SQL: {sql}")

        return sql

    async def ensure_initialized(self):
        """Ensure database is initialized - used for lazy loading in Lambda environments"""
        # Quick check without lock (double-checked locking pattern)
        if self.async_session_maker is not None:
            return

        # Use lock to prevent concurrent initialization attempts in the same Lambda execution environment
        async with self._init_lock:
            # Double-check after acquiring lock (another request might have initialized it while we waited)
            if self.async_session_maker is not None:
                return

            logger.warning("Database not initialized, attempting lazy initialization...")

        # Release lock before calling init_db() because:
        # 1. init_db() will try to acquire the same _init_lock internally (line 93), which would cause deadlock
        # 2. Note: init_db() has a bug - its lock is released after the check (line 96),
        #    so the actual initialization code (lines 98-146) is not protected by lock.
        #    This is a pre-existing issue, not introduced by this change.
        # 3. The double-checked locking pattern above ensures only one request proceeds to initialization
        try:
            await self.init_db()
            await self.create_tables()
            logger.info("Lazy database initialization completed successfully")
        except Exception as e:
            logger.error(f"Failed to lazy initialize database: {e}", exc_info=True)
            raise


db_manager = DatabaseManager()


async def get_db() -> AsyncSession:
    """FastAPI dependency for database session with lazy initialization support"""
    start_time = time.time()
    logger.debug("[DB_OP] Starting get_db session creation")

    # Lazy initialization for Lambda environments where lifespan may not trigger
    if not db_manager.async_session_maker:
        logger.warning("Database session maker not available, attempting lazy initialization...")
        try:
            await db_manager.ensure_initialized()
        except Exception as e:
            logger.error(f"Failed to ensure database initialization: {e}", exc_info=True)
            raise RuntimeError("Database initialization failed") from e

    if not db_manager.async_session_maker:
        logger.error("No async database session maker available after initialization attempt")
        raise RuntimeError("Database not initialized")

    try:
        async with db_manager.async_session_maker() as session:
            logger.debug(f"[DB_OP] Database session created successfully in {time.time() - start_time:.4f}s")
            try:
                yield session
            except Exception as e:
                logger.error(f"Database session error: {e}", exc_info=True)
                # Don't manually rollback here - AsyncSession.__aexit__ will automatically rollback on exception
                # Manual rollback would cause "cannot switch to state 15" error due to double rollback
                raise
            finally:
                logger.debug(f"[DB_OP] Database session cleanup after {time.time() - start_time:.4f}s")
                # Session is automatically closed by the async context manager when exiting 'async with'
    except Exception as e:
        logger.error(f"Failed to create database session: {e}", exc_info=True)
        raise
CLAUDE_PATCH_EOF_r2img
echo "  - backend/core/database.py OK"

mkdir -p "$(dirname "backend/alembic/versions/4b3b89225731_add_avatar_url.py")"
cat > "backend/alembic/versions/4b3b89225731_add_avatar_url.py" << 'CLAUDE_PATCH_EOF_r2img'
"""add avatar_url to users

Revision ID: 4b3b89225731
Revises: a9dbe6a8a480
Create Date: 2026-08-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4b3b89225731'
down_revision: Union[str, Sequence[str], None] = 'a9dbe6a8a480'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if 'users' not in inspector.get_table_names():
        return

    existing_columns = {col['name'] for col in inspector.get_columns('users')}
    if 'avatar_url' not in existing_columns:
        op.add_column('users', sa.Column('avatar_url', sa.String(length=500), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('users', 'avatar_url')
CLAUDE_PATCH_EOF_r2img
echo "  - backend/alembic/versions/4b3b89225731_add_avatar_url.py OK"

mkdir -p "$(dirname "frontend/src/lib/api.ts")"
cat > "frontend/src/lib/api.ts" << 'CLAUDE_PATCH_EOF_r2img'
import axios from 'axios';
import { getAPIBaseURL } from './config';
import { getStoredToken } from './auth';

// This file used to import the proprietary "@metagptx/web-sdk" (Atoms/MGX
// platform SDK), which talks to Atoms' own hosted database and only works
// inside their platform. It has been replaced with a small facade that
// keeps the exact same shape (client.auth.*, client.entities.X.query/get/create)
// but talks to our own backend on Railway instead.

const http = axios.create();

http.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) {
    config.headers = config.headers || {};
    config.headers['Authorization'] = `Bearer ${token}`;
  }
  return config;
});

function baseUrl() {
  return getAPIBaseURL();
}

interface QueryOptions {
  query?: Record<string, unknown>;
  sort?: string;
  limit?: number;
  skip?: number;
  fields?: string;
}

function makeEntity(entityName: string) {
  return {
    async query(options: QueryOptions = {}) {
      const params: Record<string, string | number> = {};
      if (options.query) params.query = JSON.stringify(options.query);
      if (options.sort) params.sort = options.sort;
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.skip !== undefined) params.skip = options.skip;
      if (options.fields) params.fields = options.fields;

      // "/all" is the public, unauthenticated listing endpoint on our
      // backend (anyone can browse products/categories without logging in).
      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}/all`, { params });
      return { data: response.data };
    },

    // The base endpoint (no "/all") requires auth and is automatically
    // scoped to the logged-in user on the backend, so this returns only
    // "my" products / favorites / messages, etc.
    async mine(options: QueryOptions = {}) {
      const params: Record<string, string | number> = {};
      if (options.query) params.query = JSON.stringify(options.query);
      if (options.sort) params.sort = options.sort;
      if (options.limit !== undefined) params.limit = options.limit;
      if (options.skip !== undefined) params.skip = options.skip;
      if (options.fields) params.fields = options.fields;

      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}`, { params });
      return { data: response.data };
    },

    async get({ id }: { id: string | number }) {
      const response = await http.get(`${baseUrl()}/api/v1/entities/${entityName}/${id}`);
      return { data: response.data };
    },

    async create({ data }: { data: Record<string, unknown> }) {
      const response = await http.post(`${baseUrl()}/api/v1/entities/${entityName}`, data);
      return { data: response.data };
    },

    async update({ id, data }: { id: string | number; data: Record<string, unknown> }) {
      const response = await http.put(`${baseUrl()}/api/v1/entities/${entityName}/${id}`, data);
      return { data: response.data };
    },

    async delete({ id }: { id: string | number }) {
      const response = await http.delete(`${baseUrl()}/api/v1/entities/${entityName}/${id}`);
      return { data: response.data };
    },
  };
}

export const client = {
  auth: {
    async me() {
      const token = getStoredToken();
      if (!token) return { data: null };
      try {
        const response = await http.get(`${baseUrl()}/api/v1/auth/me`);
        return { data: response.data };
      } catch {
        return { data: null };
      }
    },
    toLogin() {
      window.location.href = '/login';
    },
  },
  entities: {
    categories: makeEntity('categories'),
    products: makeEntity('products'),
    favorites: makeEntity('favorites'),
    messages: makeEntity('messages'),
    seller_profiles: makeEntity('seller_profiles'),
  },
  users: {
    async getProfile() {
      const response = await http.get(`${baseUrl()}/api/v1/users/profile`);
      return { data: response.data };
    },
    async updateProfile(data: { name?: string; avatar_url?: string }) {
      const response = await http.put(`${baseUrl()}/api/v1/users/profile`, data);
      return { data: response.data };
    },
  },
  storage: {
    /**
     * Uploads a single image file directly to Cloudflare R2 using a
     * short-lived presigned URL obtained from our backend, and returns the
     * public URL where the image will be accessible.
     */
    async uploadImage(file: File, folder: 'products' | 'avatars'): Promise<string> {
      const presignResponse = await http.post(`${baseUrl()}/api/v1/storage/presigned-upload`, {
        filename: file.name,
        content_type: file.type,
        folder,
      });
      const { upload_url, public_url } = presignResponse.data;

      // Upload directly to R2 (not through our backend) using plain fetch,
      // since this request must NOT include our own Authorization header.
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('No se pudo subir la imagen');
      }

      return public_url;
    },
  },
};
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/lib/api.ts OK"

mkdir -p "$(dirname "frontend/src/pages/Publicar.tsx")"
cat > "frontend/src/pages/Publicar.tsx" << 'CLAUDE_PATCH_EOF_r2img'
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Layout from '@/components/Layout';
import { client } from '@/lib/api';
import { Upload, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface Category {
  id: number;
  name: string;
  slug: string;
}

const provinces = [
  'Sevilla', 'Málaga', 'Cádiz', 'Córdoba', 'Granada', 'Huelva', 'Jaén', 'Almería',
  'Madrid', 'Barcelona', 'Valencia', 'Murcia', 'Otra',
];

const MAX_IMAGES = 6;
const MAX_FILE_SIZE_MB = 5;

export default function PublicarPage() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<unknown>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    title: '',
    description: '',
    price: '',
    category_id: '',
    condition: '',
    location_province: '',
    location_city: '',
  });

  useEffect(() => {
    checkAuth();
    loadCategories();
  }, []);

  const checkAuth = async () => {
    try {
      const res = await client.auth.me();
      if (res?.data) {
        setUser(res.data);
      }
    } catch {
      // Not logged in
    } finally {
      setAuthLoading(false);
    }
  };

  const loadCategories = async () => {
    try {
      const res = await client.entities.categories.query({ sort: 'order_index', limit: 20 });
      setCategories(res?.data?.items || []);
    } catch (err) {
      console.error('Error loading categories:', err);
    }
  };

  const handleFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow re-selecting the same file later
    if (files.length === 0) return;

    const remainingSlots = MAX_IMAGES - imageUrls.length;
    if (remainingSlots <= 0) {
      toast.error(`Máximo ${MAX_IMAGES} imágenes por anuncio`);
      return;
    }

    const filesToUpload = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      toast.info(`Solo se subirán ${remainingSlots} imagen(es) más (máximo ${MAX_IMAGES})`);
    }

    for (const file of filesToUpload) {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} no es una imagen válida`);
        continue;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`${file.name} pesa demasiado (máx. ${MAX_FILE_SIZE_MB}MB)`);
        continue;
      }

      setUploadingCount((c) => c + 1);
      try {
        const publicUrl = await client.storage.uploadImage(file, 'products');
        setImageUrls((prev) => [...prev, publicUrl]);
      } catch (err) {
        console.error('Error uploading image:', err);
        toast.error(`No se pudo subir ${file.name}`);
      } finally {
        setUploadingCount((c) => c - 1);
      }
    }
  };

  const handleRemoveImage = (url: string) => {
    setImageUrls((prev) => prev.filter((u) => u !== url));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('Debes iniciar sesión para publicar');
      client.auth.toLogin();
      return;
    }

    if (!form.title || !form.price || !form.category_id || !form.condition || !form.location_province) {
      toast.error('Completa todos los campos obligatorios');
      return;
    }

    if (imageUrls.length === 0) {
      toast.error('Añade al menos una foto del artículo');
      return;
    }

    setLoading(true);
    try {
      await client.entities.products.create({
        data: {
          title: form.title,
          description: form.description,
          price: parseFloat(form.price),
          category_id: parseInt(form.category_id),
          condition: form.condition,
          location_province: form.location_province,
          location_city: form.location_city,
          images: imageUrls.join(','),
          status: 'active',
          views_count: 0,
          is_featured: false,
        },
      });
      toast.success('¡Anuncio publicado con éxito!');
      navigate('/explorar');
    } catch (err) {
      console.error('Error creating product:', err);
      toast.error('Error al publicar. Inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/2 mx-auto" />
            <div className="h-4 bg-muted rounded w-1/3 mx-auto" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <Upload className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Inicia sesión para publicar</h2>
          <p className="text-muted-foreground mb-6">Necesitas una cuenta para publicar anuncios en VentaCofrade</p>
          <Button onClick={() => client.auth.toLogin()} className="bg-primary hover:bg-primary/90 cursor-pointer">
            Iniciar sesión
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-foreground mb-6">Publicar anuncio</h1>

        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Información del artículo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Ej: Candelabro de plata labrada siglo XIX"
                  maxLength={200}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe el artículo con detalle: estado, medidas, historia..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              {/* Price + Category */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price">Precio (€) *</Label>
                  <Input
                    id="price"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Categoría *</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Condition */}
              <div className="space-y-2">
                <Label>Estado *</Label>
                <Select value={form.condition} onValueChange={(v) => setForm({ ...form, condition: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar estado" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nuevo">Nuevo</SelectItem>
                    <SelectItem value="usado">Usado</SelectItem>
                    <SelectItem value="restaurado">Restaurado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Location */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Provincia *</Label>
                  <Select value={form.location_province} onValueChange={(v) => setForm({ ...form, location_province: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Provincia" />
                    </SelectTrigger>
                    <SelectContent>
                      {provinces.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="city">Ciudad</Label>
                  <Input
                    id="city"
                    value={form.location_city}
                    onChange={(e) => setForm({ ...form, location_city: e.target.value })}
                    placeholder="Ej: Sevilla"
                  />
                </div>
              </div>

              {/* Images */}
              <div className="space-y-2">
                <Label>Fotos *</Label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  onChange={handleFilesSelected}
                  className="hidden"
                />

                {(imageUrls.length > 0 || uploadingCount > 0) && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mb-3">
                    {imageUrls.map((url) => (
                      <div key={url} className="relative aspect-square rounded-lg overflow-hidden border border-border group">
                        <img src={url} alt="Foto del artículo" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(url)}
                          className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 cursor-pointer transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                    {Array.from({ length: uploadingCount }).map((_, i) => (
                      <div
                        key={`uploading-${i}`}
                        className="aspect-square rounded-lg border border-dashed border-border flex items-center justify-center bg-muted/50"
                      >
                        <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                      </div>
                    ))}
                  </div>
                )}

                {imageUrls.length < MAX_IMAGES && (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-colors"
                  >
                    <ImagePlus className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Toca para elegir fotos desde tu dispositivo
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      JPG, PNG o WEBP · máx. {MAX_FILE_SIZE_MB}MB cada una · hasta {MAX_IMAGES} fotos
                    </p>
                  </div>
                )}
              </div>

              <Button
                type="submit"
                disabled={loading || uploadingCount > 0}
                className="w-full bg-primary hover:bg-primary/90 h-12 text-base cursor-pointer"
              >
                {loading ? 'Publicando...' : uploadingCount > 0 ? 'Subiendo fotos...' : 'Publicar anuncio'}
              </Button>
            </CardContent>
          </Card>
        </form>
      </div>
    </Layout>
  );
}
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/pages/Publicar.tsx OK"

mkdir -p "$(dirname "frontend/src/pages/cuenta/Perfil.tsx")"
cat > "frontend/src/pages/cuenta/Perfil.tsx" << 'CLAUDE_PATCH_EOF_r2img'
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import AccountLayout from '@/components/AccountLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { client } from '@/lib/api';
import { Store, ShieldCheck, Camera, Loader2 } from 'lucide-react';

const provinces = [
  'Almería',
  'Cádiz',
  'Córdoba',
  'Granada',
  'Huelva',
  'Jaén',
  'Málaga',
  'Sevilla',
];

interface SellerProfile {
  id: number;
  shop_name: string;
  shop_description?: string;
  province: string;
  city?: string;
  phone?: string;
  is_active?: boolean;
  subscription_status?: string;
}

export default function PerfilPage() {
  const { user, refetch } = useAuth();

  // Basic account info
  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Seller / shop info
  const [sellerProfile, setSellerProfile] = useState<SellerProfile | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(true);
  const [savingSeller, setSavingSeller] = useState(false);
  const [shopName, setShopName] = useState('');
  const [shopDescription, setShopDescription] = useState('');
  const [province, setProvince] = useState('');
  const [city, setCity] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    const loadSellerProfile = async () => {
      try {
        const res = await client.entities.seller_profiles.mine({ limit: 1 });
        const profile: SellerProfile | undefined = res?.data?.items?.[0];
        if (profile) {
          setSellerProfile(profile);
          setShopName(profile.shop_name || '');
          setShopDescription(profile.shop_description || '');
          setProvince(profile.province || '');
          setCity(profile.city || '');
          setPhone(profile.phone || '');
        }
      } catch (err) {
        console.error('Error loading seller profile:', err);
      } finally {
        setLoadingSeller(false);
      }
    };
    loadSellerProfile();
  }, []);

  const handleAvatarSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Elige un archivo de imagen válido');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen no puede pesar más de 5MB');
      return;
    }

    setUploadingAvatar(true);
    try {
      const publicUrl = await client.storage.uploadImage(file, 'avatars');
      await client.users.updateProfile({ avatar_url: publicUrl });
      await refetch();
      toast.success('Foto de perfil actualizada');
    } catch (err) {
      console.error('Error uploading avatar:', err);
      toast.error('No se pudo subir la foto. Inténtalo de nuevo.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }
    setSaving(true);
    try {
      await client.users.updateProfile({ name: name.trim() });
      await refetch();
      toast.success('Perfil actualizado');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error('No se pudo guardar el perfil. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSeller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName.trim() || !province) {
      toast.error('El nombre de la tienda y la provincia son obligatorios');
      return;
    }
    setSavingSeller(true);
    try {
      const data = {
        shop_name: shopName.trim(),
        shop_description: shopDescription.trim() || undefined,
        province,
        city: city.trim() || undefined,
        phone: phone.trim() || undefined,
      };
      if (sellerProfile) {
        await client.entities.seller_profiles.update({ id: sellerProfile.id, data });
      } else {
        const res = await client.entities.seller_profiles.create({ data });
        setSellerProfile(res.data);
      }
      toast.success('Datos de vendedor guardados');
    } catch (err) {
      console.error('Error saving seller profile:', err);
      toast.error('No se pudieron guardar los datos de vendedor');
    } finally {
      setSavingSeller(false);
    }
  };

  return (
    <AccountLayout title="Mi perfil" description="Gestiona tu información personal">
      <div className="space-y-6">
        {/* Basic account info */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handleAvatarSelected}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="relative group cursor-pointer disabled:cursor-wait"
                title="Cambiar foto de perfil"
              >
                <Avatar className="h-20 w-20 border border-border">
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.name || 'Avatar'} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-semibold">
                    {(user?.name?.trim() || user?.email || '?').slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute inset-0 rounded-full bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : (
                    <Camera className="h-5 w-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </button>
              <div>
                <p className="font-medium text-foreground">Foto de perfil</p>
                <p className="text-xs text-muted-foreground">
                  Toca la imagen para cambiarla. JPG, PNG o WEBP, máx. 5MB.
                </p>
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-5 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="name">Nombre</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Tu nombre"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Correo electrónico</Label>
                <Input id="email" value={user?.email || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  El correo no se puede modificar por ahora.
                </p>
              </div>
              <Button type="submit" disabled={saving} className="cursor-pointer">
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Seller / shop info */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Store className="h-5 w-5 text-primary" />
                Datos de vendedor
              </CardTitle>
              {sellerProfile?.is_active ? (
                <Badge className="bg-green-100 text-green-700 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Tienda activa
                </Badge>
              ) : (
                <Badge variant="outline">Sin activar</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground pt-1">
              Estos datos aparecerán en tus anuncios y mejoran la confianza de los compradores.
              Complétalos ahora; se usarán al activar tu plan de vendedor en{' '}
              <span className="font-medium text-foreground">Suscripción</span>.
            </p>
          </CardHeader>
          <CardContent>
            {loadingSeller ? (
              <p className="text-sm text-muted-foreground">Cargando…</p>
            ) : (
              <form onSubmit={handleSaveSeller} className="space-y-5 max-w-md">
                <div className="space-y-2">
                  <Label htmlFor="shopName">Nombre de la tienda</Label>
                  <Input
                    id="shopName"
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Ej. Orfebrería Hermanos García"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shopDescription">Descripción</Label>
                  <Textarea
                    id="shopDescription"
                    value={shopDescription}
                    onChange={(e) => setShopDescription(e.target.value)}
                    placeholder="Cuenta a qué te dedicas, tu experiencia, especialidad…"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="province">Provincia</Label>
                    <Select value={province} onValueChange={setProvince}>
                      <SelectTrigger id="province">
                        <SelectValue placeholder="Selecciona" />
                      </SelectTrigger>
                      <SelectContent>
                        {provinces.map((p) => (
                          <SelectItem key={p} value={p}>
                            {p}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="city">Ciudad</Label>
                    <Input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="Ej. Écija"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono de contacto</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="600 000 000"
                  />
                </div>
                <Button type="submit" disabled={savingSeller} className="cursor-pointer">
                  {savingSeller ? 'Guardando…' : 'Guardar datos de vendedor'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </AccountLayout>
  );
}
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/pages/cuenta/Perfil.tsx OK"

mkdir -p "$(dirname "frontend/src/components/Layout.tsx")"
cat > "frontend/src/components/Layout.tsx" << 'CLAUDE_PATCH_EOF_r2img'
import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Menu,
  Search,
  Heart,
  User,
  Plus,
  Church,
  LogOut,
  Package,
  MessageCircle,
  CreditCard,
  ChevronDown,
} from 'lucide-react';
import { client } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();

  const navLinks = [
    { href: '/explorar', label: 'Explorar' },
    { href: '/explorar?categoria=orfebreria', label: 'Orfebrería' },
    { href: '/explorar?categoria=bordados', label: 'Bordados' },
    { href: '/vender', label: 'Vender' },
  ];

  const isActive = (href: string) => location.pathname === href.split('?')[0];

  const handleLogin = () => {
    client.auth.toLogin();
  };

  const favoritesHref = user ? '/cuenta/favoritos' : '/login';

  const initials = (user?.name?.trim() || user?.email || '?').slice(0, 1).toUpperCase();

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 cursor-pointer">
              <Church className="h-7 w-7 text-primary" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-primary leading-none">VentaCofrade</span>
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground leading-none">Marketplace Cofrade</span>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  to={link.href}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    isActive(link.href)
                      ? 'text-primary bg-primary/5'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Link to="/publicar">
                <Button size="sm" className="hidden sm:flex gap-1 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer">
                  <Plus className="h-4 w-4" />
                  Publicar
                </Button>
              </Link>
              <Link to="/explorar" className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <Search className="h-5 w-5 text-muted-foreground" />
              </Link>
              <Link to={favoritesHref} className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                <Heart className="h-5 w-5 text-muted-foreground" />
              </Link>
              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="flex items-center gap-1.5 p-1 pr-2 rounded-full hover:bg-muted transition-colors cursor-pointer">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={user.avatar_url || undefined} alt={user.name || 'Avatar'} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel className="font-normal">
                      <p className="font-semibold text-foreground truncate">{user.name || 'Mi cuenta'}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/cuenta/perfil">
                        <User className="h-4 w-4 mr-2" />
                        Mi perfil
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/cuenta/anuncios">
                        <Package className="h-4 w-4 mr-2" />
                        Mis anuncios
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/cuenta/mensajes">
                        <MessageCircle className="h-4 w-4 mr-2" />
                        Mensajes
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/cuenta/favoritos">
                        <Heart className="h-4 w-4 mr-2" />
                        Favoritos
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild className="cursor-pointer">
                      <Link to="/cuenta/suscripcion">
                        <CreditCard className="h-4 w-4 mr-2" />
                        Suscripción
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => logout()}
                      className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Cerrar sesión
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <button onClick={handleLogin} className="p-2 rounded-md hover:bg-muted transition-colors cursor-pointer">
                  <User className="h-5 w-5 text-muted-foreground" />
                </button>
              )}

              {/* Mobile menu */}
              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button className="md:hidden p-2 rounded-md hover:bg-muted cursor-pointer">
                    <Menu className="h-5 w-5" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-72">
                  <nav className="flex flex-col gap-2 mt-8">
                    {navLinks.map((link) => (
                      <Link
                        key={link.href}
                        to={link.href}
                        onClick={() => setMobileOpen(false)}
                        className={`px-4 py-3 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                          isActive(link.href)
                            ? 'text-primary bg-primary/5'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                        }`}
                      >
                        {link.label}
                      </Link>
                    ))}
                    <Link
                      to="/publicar"
                      onClick={() => setMobileOpen(false)}
                      className="px-4 py-3 rounded-md text-sm font-medium text-primary bg-primary/5 cursor-pointer"
                    >
                      + Publicar anuncio
                    </Link>
                  </nav>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <Church className="h-6 w-6" />
                <span className="text-lg font-bold">VentaCofrade</span>
              </div>
              <p className="text-sm text-primary-foreground/70">
                El marketplace de referencia del mundo cofrade en España.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Explorar</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/explorar" className="hover:text-primary-foreground transition-colors cursor-pointer">Todos los anuncios</Link></li>
                <li><Link to="/explorar?categoria=orfebreria" className="hover:text-primary-foreground transition-colors cursor-pointer">Orfebrería</Link></li>
                <li><Link to="/explorar?categoria=bordados" className="hover:text-primary-foreground transition-colors cursor-pointer">Bordados</Link></li>
                <li><Link to="/explorar?categoria=tunicas-capirotes" className="hover:text-primary-foreground transition-colors cursor-pointer">Túnicas</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Vender</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li><Link to="/vender" className="hover:text-primary-foreground transition-colors cursor-pointer">Cómo vender</Link></li>
                <li><Link to="/publicar" className="hover:text-primary-foreground transition-colors cursor-pointer">Publicar anuncio</Link></li>
                <li><Link to="/documentacion" className="hover:text-primary-foreground transition-colors cursor-pointer">Documentación</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider">Contacto</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li>Sevilla, Andalucía · España</li>
                <li>hola@ventacofrade.com</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-primary-foreground/20 mt-8 pt-6 text-center text-sm text-primary-foreground/60">
            <p>© 2026 VentaCofrade. Todos los derechos reservados.</p>
            <p className="mt-1">Hecho con devoción en Andalucía.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/components/Layout.tsx OK"

mkdir -p "$(dirname "frontend/src/components/AccountLayout.tsx")"
cat > "frontend/src/components/AccountLayout.tsx" << 'CLAUDE_PATCH_EOF_r2img'
import { ReactNode, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAuth } from '@/contexts/AuthContext';
import { User, Package, MessageCircle, Heart, CreditCard } from 'lucide-react';

interface AccountLayoutProps {
  children: ReactNode;
  title: string;
  description?: string;
}

const navItems = [
  { href: '/cuenta/perfil', label: 'Mi perfil', icon: User },
  { href: '/cuenta/anuncios', label: 'Mis anuncios', icon: Package },
  { href: '/cuenta/mensajes', label: 'Mensajes', icon: MessageCircle },
  { href: '/cuenta/favoritos', label: 'Favoritos', icon: Heart },
  { href: '/cuenta/suscripcion', label: 'Suscripción', icon: CreditCard },
];

function initials(name?: string, email?: string) {
  const source = name?.trim() || email || '?';
  return source.slice(0, 1).toUpperCase();
}

export default function AccountLayout({ children, title, description }: AccountLayoutProps) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login', { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <Layout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center text-muted-foreground">
          Cargando tu cuenta…
        </div>
      </Layout>
    );
  }

  if (!user) {
    // Waiting for the redirect effect above to kick in.
    return null;
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8">
          {/* Sidebar */}
          <aside className="md:sticky md:top-24 md:self-start">
            <div className="flex items-center gap-3 mb-6 px-1">
              <Avatar className="h-11 w-11 border border-border">
                <AvatarImage src={user.avatar_url || undefined} alt={user.name || 'Avatar'} />
                <AvatarFallback className="bg-primary text-primary-foreground font-semibold">
                  {initials(user.name, user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="font-semibold text-foreground truncate">{user.name || 'Mi cuenta'}</p>
                <p className="text-xs text-muted-foreground truncate">{user.email}</p>
              </div>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto pb-2 md:pb-0">
              {navItems.map((item) => {
                const active = location.pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm font-medium whitespace-nowrap transition-colors cursor-pointer ${
                      active
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </aside>

          {/* Content */}
          <div className="min-w-0">
            <div className="mb-6">
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              {description && <p className="text-muted-foreground mt-1">{description}</p>}
            </div>
            {children}
          </div>
        </div>
      </div>
    </Layout>
  );
}
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/components/AccountLayout.tsx OK"

mkdir -p "$(dirname "frontend/src/contexts/AuthContext.tsx")"
cat > "frontend/src/contexts/AuthContext.tsx" << 'CLAUDE_PATCH_EOF_r2img'
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { authApi } from '../lib/auth';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  role: string;
  last_login?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refetch: () => Promise<void>;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      setError(null);
      const userData = await authApi.getCurrentUser();
      setUser(userData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    // The old flow redirected straight to an external OIDC provider.
    // Now we just send the user to our own login/register page.
    window.location.href = '/login';
  };

  const logout = async () => {
    try {
      setError(null);
      await authApi.logout();
      setUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Logout failed');
    }
  };

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const value: AuthContextType = {
    user,
    loading,
    error,
    login,
    logout,
    refetch: checkAuthStatus,
    isAdmin: user?.role === 'admin',
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
CLAUDE_PATCH_EOF_r2img
echo "  - frontend/src/contexts/AuthContext.tsx OK"

git add -A
git commit -m "Sistema de imagenes real con Cloudflare R2: subida de fotos en Publicar y avatar en Perfil"
git push
echo ""
echo "Listo. Cambios subidos a GitHub."
echo "IMPORTANTE: ahora ve a Railway y anade las variables R2_* (ver instrucciones del chat) antes de que la subida de imagenes funcione en produccion."
