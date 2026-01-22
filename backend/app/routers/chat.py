from typing import List, Optional
from uuid import UUID
import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models import Project, Agent, AgentVersion, ChatHistory, ProjectAPIKey
from app.schemas import ChatRequest, ChatResponse, ChatHistoryResponse, ChatHistoryItem
from app.utils.auth import get_project_with_api_key, get_current_project
from app.services.langchain_service import LangChainService

router = APIRouter(prefix="/chat", tags=["Chat"])

@router.post("", response_model=ChatResponse)
async def send_message(
    chat_request: ChatRequest,
    project_api_ctx=Depends(get_project_with_api_key),
    db: AsyncSession = Depends(get_db)
):
    """Send a chat message to an agent"""
    project, api_key = project_api_ctx
    if api_key is None:
        # If bearer was JWT, reject: chat must use project API key bearer for tracking
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Chat API requires Project API Key as bearer token"
        )
    # Verify agent belongs to project
    result = await db.execute(
        select(Agent)
        .where(
            Agent.project_id == project.id,
            func.lower(Agent.name) == func.lower(chat_request.agent_name)
        )
        .options(selectinload(Agent.versions))
    )
    agent = result.scalar_one_or_none()
    
    if not agent:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Agent not found in this project"
        )
    
    # Get the version to use
    if chat_request.version_number is not None:
        version_result = await db.execute(
            select(AgentVersion).where(
                AgentVersion.agent_id == agent.id,
                AgentVersion.version_number == chat_request.version_number
            )
        )
        agent_version = version_result.scalar_one_or_none()
        if not agent_version:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Version not found for this agent"
            )
    else:
        version_result = await db.execute(
            select(AgentVersion).where(
                AgentVersion.agent_id == agent.id,
                AgentVersion.is_active == True
            )
        )
        agent_version = version_result.scalar_one_or_none()
        if not agent_version:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active version found for this agent. Please activate a version first."
            )

    session_uuid: Optional[UUID] = None
    if chat_request.session_id:
        try:
            session_uuid = UUID(chat_request.session_id)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid session_id format"
            )

        session_exists = await db.execute(
            select(ChatHistory.id).where(
                ChatHistory.session_id == session_uuid,
                ChatHistory.project_id == project.id
            )
        )
        if session_exists.first() is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Session ID not found"
            )
    
    # Process with LangChain
    try:
        response = await LangChainService.get_chat_response(
            db=db,
            agent_version=agent_version,
            message=chat_request.message,
            project_id=project.id,
            session_id=session_uuid,
            project_api_key_id=api_key.id
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

    # Mark key as used after successful processing
    api_key.last_used_at = datetime.utcnow()
    await db.commit()
    await db.refresh(api_key)

    return ChatResponse(
        **response,
        agent_name=agent.name
    )

@router.get("/history/{session_id}", response_model=List[ChatHistoryResponse])
async def get_chat_history(
    session_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Get chat history for a session"""
    result = await db.execute(
        select(ChatHistory)
        .where(
            ChatHistory.session_id == session_id,
            ChatHistory.project_id == project.id
        )
        .order_by(ChatHistory.created_at)
    )
    history = result.scalars().all()
    
    return [ChatHistoryResponse.model_validate(h) for h in history]

@router.get("/history", response_model=List[ChatHistoryItem])
async def list_chat_history(
    agent_id: Optional[UUID] = None,
    version_number: Optional[int] = None,
    api_key_id: Optional[UUID] = None,
    session_id: Optional[UUID] = None,
    limit: int = 100,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """List chat history with optional filters."""
    limit = min(max(limit, 1), 500)

    query = (
        select(
            ChatHistory.id,
            ChatHistory.session_id,
            ChatHistory.role,
            ChatHistory.content,
            ChatHistory.tokens_used,
            ChatHistory.prompt_tokens,
            ChatHistory.completion_tokens,
            ChatHistory.created_at,
            Agent.name.label("agent_name"),
            AgentVersion.version_number,
            AgentVersion.model_name,
            ChatHistory.project_api_key_id.label("api_key_id")
        )
        .join(AgentVersion, AgentVersion.id == ChatHistory.agent_version_id)
        .join(Agent, Agent.id == AgentVersion.agent_id)
        .where(ChatHistory.project_id == project.id)
        .order_by(ChatHistory.created_at.desc())
        .limit(limit)
    )

    if agent_id:
        query = query.where(Agent.id == agent_id)
    if version_number is not None:
        query = query.where(AgentVersion.version_number == version_number)
    if api_key_id:
        query = query.where(ChatHistory.project_api_key_id == api_key_id)
    if session_id:
        query = query.where(ChatHistory.session_id == session_id)

    result = await db.execute(query)
    rows = result.all()
    return [
        ChatHistoryItem(
            id=row.id,
            session_id=row.session_id,
            agent_name=row.agent_name,
            version_number=row.version_number,
            model_name=row.model_name,
            api_key_id=row.api_key_id,
            role=row.role,
            content=row.content,
            tokens_used=row.tokens_used,
            prompt_tokens=row.prompt_tokens,
            completion_tokens=row.completion_tokens,
            created_at=row.created_at
        )
        for row in rows
    ]

@router.get("/sessions", response_model=List[dict])
async def list_chat_sessions(
    agent_id: Optional[UUID] = None,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """List all chat sessions for the project"""
    query = select(
        ChatHistory.session_id,
        ChatHistory.agent_version_id,
        ChatHistory.created_at
    ).where(ChatHistory.project_id == project.id)
    
    if agent_id:
        query = query.join(AgentVersion).where(AgentVersion.agent_id == agent_id)
    
    query = query.distinct(ChatHistory.session_id).order_by(
        ChatHistory.session_id,
        ChatHistory.created_at.desc()
    )
    
    result = await db.execute(query)
    sessions = result.all()
    
    return [
        {
            "session_id": str(s.session_id),
            "agent_version_id": str(s.agent_version_id),
            "last_message_at": s.created_at.isoformat()
        }
        for s in sessions
    ]

@router.delete("/history/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_history(
    session_id: UUID,
    project: Project = Depends(get_current_project),
    db: AsyncSession = Depends(get_db)
):
    """Delete chat history for a session"""
    result = await db.execute(
        select(ChatHistory).where(
            ChatHistory.session_id == session_id,
            ChatHistory.project_id == project.id
        )
    )
    history = result.scalars().all()
    
    for h in history:
        await db.delete(h)
    
    await db.commit()
