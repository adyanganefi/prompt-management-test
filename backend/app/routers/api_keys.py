from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Project, ProjectAPIKey
from app.schemas import APIKeyCreate, APIKeyResponse, APIKeyMasked
from app.utils.auth import get_current_project
from app.utils.encryption import generate_api_key, mask_api_key

router = APIRouter(prefix="/api-keys", tags=["API Keys"])

@router.post("", response_model=APIKeyResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(
    api_key_data: APIKeyCreate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Create a new API key for the project"""
    new_key = generate_api_key()
    
    db_api_key = ProjectAPIKey(
        project_id=project.id,
        name=api_key_data.name,
        api_key=new_key
    )
    db.add(db_api_key)
    await db.commit()
    await db.refresh(db_api_key)
    
    return APIKeyResponse.model_validate(db_api_key)

@router.get("", response_model=List[APIKeyMasked])
async def list_api_keys(
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """List all API keys for the project (masked)"""
    result = await db.execute(
        select(ProjectAPIKey)
        .where(ProjectAPIKey.project_id == project.id)
        .order_by(ProjectAPIKey.created_at.desc())
    )
    api_keys = result.scalars().all()
    
    return [
        APIKeyMasked(
            id=key.id,
            project_id=key.project_id,
            name=key.name,
            api_key_masked=mask_api_key(key.api_key),
            is_active=key.is_active,
            created_at=key.created_at,
            last_used_at=key.last_used_at
        )
        for key in api_keys
    ]

@router.get("/{key_id}/reveal", response_model=APIKeyMasked)
async def reveal_api_key(
    key_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Reveal the full API key"""
    result = await db.execute(
        select(ProjectAPIKey).where(
            ProjectAPIKey.id == key_id,
            ProjectAPIKey.project_id == project.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    return APIKeyMasked(
        id=api_key.id,
        project_id=api_key.project_id,
        name=api_key.name,
        api_key_masked=mask_api_key(api_key.api_key),
        api_key=api_key.api_key,
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at
    )

@router.patch("/{key_id}/toggle", response_model=APIKeyMasked)
async def toggle_api_key(
    key_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Toggle API key active status"""
    result = await db.execute(
        select(ProjectAPIKey).where(
            ProjectAPIKey.id == key_id,
            ProjectAPIKey.project_id == project.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    api_key.is_active = not api_key.is_active
    await db.commit()
    await db.refresh(api_key)
    
    return APIKeyMasked(
        id=api_key.id,
        project_id=api_key.project_id,
        name=api_key.name,
        api_key_masked=mask_api_key(api_key.api_key),
        is_active=api_key.is_active,
        created_at=api_key.created_at,
        last_used_at=api_key.last_used_at
    )

@router.delete("/{key_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_api_key(
    key_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Delete an API key"""
    result = await db.execute(
        select(ProjectAPIKey).where(
            ProjectAPIKey.id == key_id,
            ProjectAPIKey.project_id == project.id
        )
    )
    api_key = result.scalar_one_or_none()
    
    if not api_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="API key not found"
        )
    
    await db.delete(api_key)
    await db.commit()
