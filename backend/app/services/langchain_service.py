from typing import Optional, List
from uuid import UUID
import uuid
from datetime import datetime
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import AgentVersion, ChatHistory
from app.utils.encryption import decrypt_api_key

class LangChainService:
    @staticmethod
    async def get_chat_response(
        db: AsyncSession,
        agent_version: AgentVersion,
        message: str,
        project_id: UUID,
        session_id: Optional[UUID] = None,
        project_api_key_id: Optional[UUID] = None
    ) -> dict:
        """Process a chat message using LangChain"""
        
        # Generate session ID if not provided
        if session_id is None:
            session_id = uuid.uuid4()
        
        # Decrypt the API key
        api_key = decrypt_api_key(agent_version.api_key_encrypted)
        
        # Configure LLM
        llm_config = {
            "model": agent_version.model_name,
            "api_key": api_key,
            "temperature": float(agent_version.temperature),
            "max_tokens": agent_version.max_tokens,
        }
        
        if agent_version.base_url:
            llm_config["base_url"] = agent_version.base_url
        
        if agent_version.top_p:
            llm_config["model_kwargs"] = {
                "top_p": float(agent_version.top_p),
                "frequency_penalty": float(agent_version.frequency_penalty or 0),
                "presence_penalty": float(agent_version.presence_penalty or 0),
            }
            if agent_version.stop_sequences:
                llm_config["model_kwargs"]["stop"] = agent_version.stop_sequences
        
        llm = ChatOpenAI(**llm_config)
        
        # Get conversation history for this session
        result = await db.execute(
            select(ChatHistory)
            .where(
                ChatHistory.session_id == session_id,
                ChatHistory.project_id == project_id
            )
            .order_by(ChatHistory.created_at)
        )
        history = result.scalars().all()
        
        # Build messages list
        messages = [SystemMessage(content=agent_version.system_prompt)]
        
        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))
        
        # Add the new user message
        messages.append(HumanMessage(content=message))
        
        # Save user message to history
        now = datetime.utcnow()
        user_chat = ChatHistory(
            project_id=project_id,
            agent_version_id=agent_version.id,
            project_api_key_id=project_api_key_id,
            session_id=session_id,
            role="user",
            content=message,
            created_at=now
        )
        db.add(user_chat)
        
        # Get response from LLM
        try:
            response = await llm.ainvoke(messages)
            response_content = response.content
            tokens_used = None
            prompt_tokens = None
            completion_tokens = None
            
            # Try to get token usage if available
            if hasattr(response, 'response_metadata'):
                token_usage = response.response_metadata.get('token_usage', {})
                tokens_used = token_usage.get('total_tokens')
                prompt_tokens = token_usage.get('prompt_tokens')
                completion_tokens = token_usage.get('completion_tokens')
        except Exception as e:
            # Save error and re-raise
            await db.rollback()
            raise Exception(f"LLM Error: {str(e)}")
        
        # Save assistant response to history
        assistant_chat = ChatHistory(
            project_id=project_id,
            agent_version_id=agent_version.id,
            project_api_key_id=project_api_key_id,
            session_id=session_id,
            role="assistant",
            content=response_content,
            tokens_used=tokens_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            created_at=datetime.utcnow()
        )
        db.add(assistant_chat)
        await db.commit()

        # Hitung total token sesi (akumulasi) bila tersedia
        total_tokens = None
        if session_id:
            total_result = await db.execute(
                select(func.sum(ChatHistory.tokens_used)).where(
                    ChatHistory.session_id == session_id,
                    ChatHistory.project_id == project_id
                )
            )
            total_tokens = total_result.scalar()
        
        return {
            "response": response_content,
            "session_id": session_id,
            "tokens_used": tokens_used,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "model_name": agent_version.model_name,
            "version_number": agent_version.version_number
        }
