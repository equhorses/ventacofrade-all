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
