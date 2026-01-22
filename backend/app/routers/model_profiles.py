from uuid import UUID
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import Project, ModelProfile
from app.schemas import (
    ModelProfileCreate,
    ModelProfileUpdate,
    ModelProfileResponse,
    ModelProfileReveal,
)
from app.utils.auth import get_current_project
from app.utils.encryption import encrypt_api_key, decrypt_api_key, mask_api_key

router = APIRouter(prefix="/model-profiles", tags=["Model Profiles"])


def _profile_response(profile: ModelProfile) -> ModelProfileResponse:
    return ModelProfileResponse(
        id=profile.id,
        project_id=profile.project_id,
        name=profile.name,
        base_url=profile.base_url,
        api_key_masked=mask_api_key(decrypt_api_key(profile.api_key_encrypted)),
        created_at=profile.created_at,
        updated_at=profile.updated_at,
    )


@router.get("", response_model=list[ModelProfileResponse])
async def list_profiles(
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ModelProfile)
        .where(ModelProfile.project_id == project.id)
        .order_by(ModelProfile.created_at.desc())
    )
    profiles = result.scalars().all()
    return [_profile_response(p) for p in profiles]


@router.post("", response_model=ModelProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    payload: ModelProfileCreate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    # Ensure unique name per project
    existing = await db.execute(
        select(ModelProfile).where(
            ModelProfile.project_id == project.id,
            ModelProfile.name == payload.name
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Profil dengan nama ini sudah ada"
        )

    encrypted = encrypt_api_key(payload.api_key)
    profile = ModelProfile(
        project_id=project.id,
        name=payload.name,
        base_url=payload.base_url,
        api_key_encrypted=encrypted,
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return _profile_response(profile)


@router.get("/{profile_id}/reveal", response_model=ModelProfileReveal)
async def reveal_profile(
    profile_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ModelProfile).where(
            ModelProfile.id == profile_id,
            ModelProfile.project_id == project.id
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan"
        )

    api_key = decrypt_api_key(profile.api_key_encrypted)
    return ModelProfileReveal(
        **_profile_response(profile).model_dump(),
        api_key=api_key
    )


@router.patch("/{profile_id}", response_model=ModelProfileResponse)
async def update_profile(
    profile_id: UUID,
    payload: ModelProfileUpdate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ModelProfile).where(
            ModelProfile.id == profile_id,
            ModelProfile.project_id == project.id
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan"
        )

    if payload.name and payload.name != profile.name:
        dup = await db.execute(
            select(ModelProfile).where(
                ModelProfile.project_id == project.id,
                ModelProfile.name == payload.name,
                ModelProfile.id != profile_id
            )
        )
        if dup.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Profil dengan nama ini sudah ada"
            )
        profile.name = payload.name

    if payload.base_url is not None:
        profile.base_url = payload.base_url

    if payload.api_key:
        profile.api_key_encrypted = encrypt_api_key(payload.api_key)

    profile.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(profile)
    return _profile_response(profile)


@router.delete("/{profile_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_profile(
    profile_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ModelProfile).where(
            ModelProfile.id == profile_id,
            ModelProfile.project_id == project.id
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Profil tidak ditemukan"
        )

    await db.delete(profile)
    await db.commit()