from datetime import timedelta
from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from app.database import get_db
from app.models import Project, Agent, ProjectAPIKey
from app.schemas import (
    ProjectCreate, ProjectLogin, ProjectUpdate, ProjectResponse, 
    ProjectWithStats, Token
)
from app.utils.auth import (
    get_password_hash, verify_password, create_access_token,
    get_current_project
)
from app.config import settings

router = APIRouter(prefix="/projects", tags=["Projects"])

@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
async def register_project(project: ProjectCreate, db: AsyncSession = Depends(get_db)):
    """Register a new project with credentials"""
    # Check if username already exists
    result = await db.execute(select(Project).where(Project.username == project.username))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Create project
    db_project = Project(
        name=project.name,
        description=project.description,
        username=project.username,
        password_hash=get_password_hash(project.password)
    )
    db.add(db_project)
    await db.commit()
    await db.refresh(db_project)
    
    # Create access token
    access_token = create_access_token(
        data={"sub": str(db_project.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        project=ProjectResponse.model_validate(db_project)
    )

@router.post("/login", response_model=Token)
async def login_project(credentials: ProjectLogin, db: AsyncSession = Depends(get_db)):
    """Login to a project"""
    result = await db.execute(select(Project).where(Project.username == credentials.username))
    project = result.scalar_one_or_none()
    
    if not project or not verify_password(credentials.password, project.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    access_token = create_access_token(
        data={"sub": str(project.id)},
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes)
    )
    
    return Token(
        access_token=access_token,
        token_type="bearer",
        project=ProjectResponse.model_validate(project)
    )

@router.get("/me", response_model=ProjectWithStats)
async def get_current_project_info(
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Get current project info with stats"""
    # Get agents count
    agents_result = await db.execute(
        select(func.count(Agent.id)).where(Agent.project_id == project.id)
    )
    agents_count = agents_result.scalar()
    
    # Get API keys count
    keys_result = await db.execute(
        select(func.count(ProjectAPIKey.id)).where(ProjectAPIKey.project_id == project.id)
    )
    api_keys_count = keys_result.scalar()
    
    return ProjectWithStats(
        **ProjectResponse.model_validate(project).model_dump(),
        agents_count=agents_count,
        api_keys_count=api_keys_count
    )

@router.put("/me", response_model=ProjectResponse)
async def update_current_project(
    update: ProjectUpdate,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Update current project"""
    if update.name is not None:
        project.name = update.name
    if update.description is not None:
        project.description = update.description
    
    await db.commit()
    await db.refresh(project)
    
    return ProjectResponse.model_validate(project)

@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT)
async def delete_current_project(
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Delete current project (requires authentication)"""
    await db.delete(project)
    await db.commit()
