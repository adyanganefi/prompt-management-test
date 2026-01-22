from datetime import datetime, timedelta
from typing import Optional
from uuid import UUID
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.config import settings
from app.database import get_db
from app.models import Project, ProjectAPIKey

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt

async def get_current_project(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
) -> Project:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = credentials.credentials
    
    # First, check if it's a JWT token
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        project_id: str = payload.get("sub")
        if project_id is None:
            raise credentials_exception
        
        result = await db.execute(select(Project).where(Project.id == UUID(project_id)))
        project = result.scalar_one_or_none()
        
        if project is None:
            raise credentials_exception
        return project
    except JWTError:
        pass
    
    # If not JWT, check if it's a project API key
    result = await db.execute(
        select(ProjectAPIKey).where(
            ProjectAPIKey.api_key == token,
            ProjectAPIKey.is_active == True
        )
    )
    api_key = result.scalar_one_or_none()
    
    if api_key is None:
        raise credentials_exception
    
    # Update last used
    api_key.last_used_at = datetime.utcnow()
    await db.commit()
    
    # Get the project
    result = await db.execute(select(Project).where(Project.id == api_key.project_id))
    project = result.scalar_one_or_none()
    
    if project is None:
        raise credentials_exception
    
    return project


async def get_project_with_api_key(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_db)
):
    """Return (project, api_key) where bearer can be JWT or project API key."""
    project = await get_current_project(credentials, db)

    # If bearer is API key, fetch it; if JWT, there's no api_key context
    token = credentials.credentials
    api_key = None
    result = await db.execute(
        select(ProjectAPIKey).where(
            ProjectAPIKey.api_key == token,
            ProjectAPIKey.is_active == True
        )
    )
    api_key = result.scalar_one_or_none()
    return project, api_key
