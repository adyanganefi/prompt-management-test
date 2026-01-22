from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Project, Agent, AgentVersion, ModelProfile
from app.schemas import (
    AgentCreate, AgentUpdate, AgentResponse, AgentWithVersions,
    AgentVersionCreate, AgentVersionResponse, AgentVersionCompare
)
from app.utils.auth import get_current_project
from app.utils.encryption import encrypt_api_key

router = APIRouter(prefix="/agents", tags=["Agents"])


def _version_to_response(version: AgentVersion) -> AgentVersionResponse:
    profile_name = None
    if version.model_profile and getattr(version.model_profile, "name", None):
        profile_name = version.model_profile.name
    resp = AgentVersionResponse.from_orm(version)
    resp.model_profile_name = profile_name
    return resp

@router.post("", response_model=AgentResponse, status_code=status.HTTP_201_CREATED)
async def create_agent(
    agent: AgentCreate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Create a new agent"""
    # Check if agent name already exists in project
    result = await db.execute(
        select(Agent).where(
            Agent.project_id == project.id,
            Agent.name == agent.name
        )
    )
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Agent with this name already exists in the project"
        )
    
    db_agent = Agent(
        project_id=project.id,
        name=agent.name,
        description=agent.description
    )
    db.add(db_agent)
    await db.commit()
    await db.refresh(db_agent)
    
    return AgentResponse.model_validate(db_agent)

@router.get("", response_model=List[AgentWithVersions])
async def list_agents(
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """List all agents for the project with their versions"""
    result = await db.execute(
        select(Agent)
        .where(Agent.project_id == project.id)
        .options(selectinload(Agent.versions).selectinload(AgentVersion.model_profile))
        .order_by(Agent.created_at.desc())
    )
    agents = result.scalars().all()
    
    response = []
    for agent in agents:
        versions = [_version_to_response(v) for v in agent.versions]
        active_version = next((v for v in versions if v.is_active), None)
        
        response.append(AgentWithVersions(
            **AgentResponse.model_validate(agent).model_dump(),
            versions=versions,
            active_version=active_version
        ))
    
    return response

@router.get("/{agent_id}", response_model=AgentWithVersions)
async def get_agent(
    agent_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific agent with versions"""
    result = await db.execute(
        select(Agent)
        .where(Agent.id == agent_id, Agent.project_id == project.id)
        .options(selectinload(Agent.versions).selectinload(AgentVersion.model_profile))
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    versions = [_version_to_response(v) for v in agent.versions]
    active_version = next((v for v in versions if v.is_active), None)
    
    return AgentWithVersions(
        **AgentResponse.model_validate(agent).model_dump(),
        versions=versions,
        active_version=active_version
    )

@router.put("/{agent_id}", response_model=AgentResponse)
async def update_agent(
    agent_id: UUID,
    update: AgentUpdate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Update agent info (name/description only)"""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project.id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    if update.name is not None:
        # Check for duplicate name
        existing = await db.execute(
            select(Agent).where(
                Agent.project_id == project.id,
                Agent.name == update.name,
                Agent.id != agent_id
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Agent with this name already exists"
            )
        agent.name = update.name
    
    if update.description is not None:
        agent.description = update.description
    
    await db.commit()
    await db.refresh(agent)
    
    return AgentResponse.model_validate(agent)

# ============ Agent Versions ============

@router.post("/{agent_id}/versions", response_model=AgentVersionResponse, status_code=status.HTTP_201_CREATED)
async def create_agent_version(
    agent_id: UUID,
    version: AgentVersionCreate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Create a new version for an agent (immutable once created)"""
    # Verify agent exists and belongs to project
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project.id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    # Get next version number
    version_result = await db.execute(
        select(func.coalesce(func.max(AgentVersion.version_number), 0) + 1)
        .where(AgentVersion.agent_id == agent_id)
    )
    next_version = version_result.scalar()

    # Resolve model profile if provided
    encrypted_api_key = None
    base_url = version.base_url
    model_profile_id = None

    if version.model_profile_id:
        profile_result = await db.execute(
            select(ModelProfile).where(
                ModelProfile.id == version.model_profile_id,
                ModelProfile.project_id == project.id
            )
        )
        profile = profile_result.scalar_one_or_none()
        if not profile:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Model profile not found"
            )
        encrypted_api_key = profile.api_key_encrypted
        base_url = profile.base_url
        model_profile_id = profile.id

    if not encrypted_api_key:
        encrypted_api_key = encrypt_api_key(version.api_key)

    db_version = AgentVersion(
        agent_id=agent_id,
        version_number=next_version,
        system_prompt=version.system_prompt,
        model_name=version.model_name,
        api_key_encrypted=encrypted_api_key,
        model_profile_id=model_profile_id,
        base_url=base_url,
        temperature=version.temperature,
        max_tokens=version.max_tokens,
        top_p=version.top_p,
        frequency_penalty=version.frequency_penalty,
        presence_penalty=version.presence_penalty,
        stop_sequences=version.stop_sequences,
        notes=version.notes,
        is_active=False  # New versions are not active by default
    )
    db.add(db_version)
    await db.commit()
    await db.refresh(db_version)

    return _version_to_response(db_version)

@router.get("/{agent_id}/versions", response_model=List[AgentVersionResponse])
async def list_agent_versions(
    agent_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """List all versions for an agent"""
    # Verify agent belongs to project
    agent_result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project.id)
    )
    if not agent_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    result = await db.execute(
        select(AgentVersion)
        .where(AgentVersion.agent_id == agent_id)
        .options(selectinload(AgentVersion.model_profile))
        .order_by(AgentVersion.version_number.desc())
    )
    versions = result.scalars().all()

    return [_version_to_response(v) for v in versions]

@router.get("/{agent_id}/versions/compare", response_model=AgentVersionCompare)
async def compare_versions(
    agent_id: UUID,
    version1: int = Query(..., description="First version number"),
    version2: int = Query(..., description="Second version number"),
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Compare two versions"""
    # Get both versions
    result1 = await db.execute(
        select(AgentVersion)
        .join(Agent)
        .where(
            AgentVersion.agent_id == agent_id,
            AgentVersion.version_number == version1,
            Agent.project_id == project.id
        )
        .options(selectinload(AgentVersion.model_profile))
    )
    v1 = result1.scalar_one_or_none()
    
    result2 = await db.execute(
        select(AgentVersion)
        .join(Agent)
        .where(
            AgentVersion.agent_id == agent_id,
            AgentVersion.version_number == version2,
            Agent.project_id == project.id
        )
        .options(selectinload(AgentVersion.model_profile))
    )
    v2 = result2.scalar_one_or_none()
    
    if not v1 or not v2:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="One or both versions not found"
        )
    
    # Calculate differences
    differences = {}
    compare_fields = ['system_prompt', 'model_name', 'base_url', 'temperature', 
                      'max_tokens', 'top_p', 'frequency_penalty', 'presence_penalty', 
                      'stop_sequences', 'notes']
    
    for field in compare_fields:
        val1 = getattr(v1, field)
        val2 = getattr(v2, field)
        if val1 != val2:
            differences[field] = {
                "version_1": val1,
                "version_2": val2
            }
    
    return AgentVersionCompare(
        version_1=_version_to_response(v1),
        version_2=_version_to_response(v2),
        differences=differences
    )

@router.get("/{agent_id}/versions/{version_id}", response_model=AgentVersionResponse)
async def get_agent_version(
    agent_id: UUID,
    version_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Get a specific version"""
    result = await db.execute(
        select(AgentVersion)
        .join(Agent)
        .where(
            AgentVersion.id == version_id,
            AgentVersion.agent_id == agent_id,
            Agent.project_id == project.id
        )
        .options(selectinload(AgentVersion.model_profile))
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    return _version_to_response(version)

@router.patch("/{agent_id}/versions/{version_id}/activate", response_model=AgentVersionResponse)
async def activate_version(
    agent_id: UUID,
    version_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Set a version as active (production)"""
    result = await db.execute(
        select(AgentVersion)
        .join(Agent)
        .where(
            AgentVersion.id == version_id,
            AgentVersion.agent_id == agent_id,
            Agent.project_id == project.id
        )
        .options(selectinload(AgentVersion.model_profile))
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    # Deactivate all other versions
    all_versions_result = await db.execute(
        select(AgentVersion).where(AgentVersion.agent_id == agent_id)
    )
    for v in all_versions_result.scalars().all():
        v.is_active = False
    
    # Activate this version
    version.is_active = True
    await db.commit()

    # Pastikan relasi model_profile tetap tersedia tanpa lazy load
    refreshed = await db.execute(
        select(AgentVersion)
        .options(selectinload(AgentVersion.model_profile))
        .where(AgentVersion.id == version.id)
    )
    version_loaded = refreshed.scalar_one()

    return _version_to_response(version_loaded)

@router.delete("/{agent_id}/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    agent_id: UUID,
    version_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Delete a specific version (not the entire agent)"""
    result = await db.execute(
        select(AgentVersion)
        .join(Agent)
        .where(
            AgentVersion.id == version_id,
            AgentVersion.agent_id == agent_id,
            Agent.project_id == project.id
        )
    )
    version = result.scalar_one_or_none()
    
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Version not found"
        )
    
    # Check if this is the only version
    count_result = await db.execute(
        select(func.count(AgentVersion.id)).where(AgentVersion.agent_id == agent_id)
    )
    count = count_result.scalar()
    
    if count <= 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete the only version. Delete the agent instead."
        )
    
    await db.delete(version)
    await db.commit()

@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(
    agent_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Delete an agent and all its versions"""
    result = await db.execute(
        select(Agent).where(Agent.id == agent_id, Agent.project_id == project.id)
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found"
        )
    
    await db.delete(agent)
    await db.commit()
