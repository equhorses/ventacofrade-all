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
