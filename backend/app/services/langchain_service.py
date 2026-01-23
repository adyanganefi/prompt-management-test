from typing import Optional, List, AsyncGenerator, Tuple, Dict
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
        project_api_key_id: Optional[UUID] = None,
        system_prompt: Optional[str] = None
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
            "stream_usage": True,  # Enable token usage tracking for both HTTP and streaming
        }
        
        if agent_version.base_url:
            llm_config["base_url"] = agent_version.base_url

        # Penalties and sampling params should be passed explicitly (avoid model_kwargs warnings)
        llm_config["top_p"] = float(agent_version.top_p) if agent_version.top_p is not None else None
        llm_config["frequency_penalty"] = float(agent_version.frequency_penalty or 0)
        llm_config["presence_penalty"] = float(agent_version.presence_penalty or 0)
        if agent_version.stop_sequences:
            llm_config["stop"] = agent_version.stop_sequences

        # Remove None values to keep payload clean
        llm_config = {k: v for k, v in llm_config.items() if v is not None}
        
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
        prompt_text = system_prompt or agent_version.system_prompt
        messages = [SystemMessage(content=prompt_text)]
        
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
            usage = None
            if hasattr(response, 'usage_metadata') and response.usage_metadata:
                usage = response.usage_metadata
            if not usage and hasattr(response, 'response_metadata') and response.response_metadata:
                usage = response.response_metadata.get('token_usage') or response.response_metadata.get('usage')
            if usage:
                tokens_used = usage.get('total_tokens') or usage.get('total')
                prompt_tokens = usage.get('prompt_tokens') or usage.get('input_tokens')
                completion_tokens = usage.get('completion_tokens') or usage.get('output_tokens')
                
                # Calculate tokens_used from prompt + completion if available
                if prompt_tokens is not None and completion_tokens is not None:
                    calculated_tokens = prompt_tokens + completion_tokens
                    # Use calculated value if total_tokens is not available or seems incorrect
                    if tokens_used is None or tokens_used == 0 or tokens_used != calculated_tokens:
                        tokens_used = calculated_tokens
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
        total_prompt_tokens = None
        total_completion_tokens = None
        if session_id:
            # Total tokens
            total_result = await db.execute(
                select(func.sum(ChatHistory.tokens_used)).where(
                    ChatHistory.session_id == session_id,
                    ChatHistory.project_id == project_id
                )
            )
            total_tokens = total_result.scalar()
            
            # Total prompt tokens
            prompt_result = await db.execute(
                select(func.sum(ChatHistory.prompt_tokens)).where(
                    ChatHistory.session_id == session_id,
                    ChatHistory.project_id == project_id,
                    ChatHistory.prompt_tokens.isnot(None)
                )
            )
            total_prompt_tokens = prompt_result.scalar()
            
            # Total completion tokens
            completion_result = await db.execute(
                select(func.sum(ChatHistory.completion_tokens)).where(
                    ChatHistory.session_id == session_id,
                    ChatHistory.project_id == project_id,
                    ChatHistory.completion_tokens.isnot(None)
                )
            )
            total_completion_tokens = completion_result.scalar()
        
        return {
            "response": response_content,
            "session_id": session_id,
            "tokens_used": tokens_used,
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "total_prompt_tokens": total_prompt_tokens,
            "total_completion_tokens": total_completion_tokens,
            "model_name": agent_version.model_name,
            "version_number": agent_version.version_number
        }

    @staticmethod
    async def stream_chat_response(
        db: AsyncSession,
        agent_version: AgentVersion,
        message: str,
        project_id: UUID,
        session_id: Optional[UUID] = None,
        project_api_key_id: Optional[UUID] = None,
        system_prompt: Optional[str] = None
    ) -> Tuple[AsyncGenerator[str, None], Dict[str, Optional[object]], Dict[str, Optional[int]]]:
        """Stream a chat response token-by-token using LangChain."""

        # Generate session ID if not provided
        if session_id is None:
            session_id = uuid.uuid4()

        # Decrypt the API key
        api_key = decrypt_api_key(agent_version.api_key_encrypted)

        # Configure LLM (streaming)
        llm_config = {
            "model": agent_version.model_name,
            "api_key": api_key,
            "temperature": float(agent_version.temperature),
            "max_tokens": agent_version.max_tokens,
            "streaming": True,
            "stream_usage": True,
        }

        if agent_version.base_url:
            llm_config["base_url"] = agent_version.base_url

        llm_config["top_p"] = float(agent_version.top_p) if agent_version.top_p is not None else None
        llm_config["frequency_penalty"] = float(agent_version.frequency_penalty or 0)
        llm_config["presence_penalty"] = float(agent_version.presence_penalty or 0)
        if agent_version.stop_sequences:
            llm_config["stop"] = agent_version.stop_sequences

        llm_config = {k: v for k, v in llm_config.items() if v is not None}

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
        prompt_text = system_prompt or agent_version.system_prompt
        messages = [SystemMessage(content=prompt_text)]

        for msg in history:
            if msg.role == "user":
                messages.append(HumanMessage(content=msg.content))
            elif msg.role == "assistant":
                messages.append(AIMessage(content=msg.content))

        messages.append(HumanMessage(content=message))

        # Save user message to history before streaming
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
        await db.commit()

        response_meta = {
            "session_id": session_id,
            "model_name": agent_version.model_name,
            "version_number": agent_version.version_number,
        }

        stats: Dict[str, Optional[int]] = {
            "tokens_used": None,
            "prompt_tokens": None,
            "completion_tokens": None,
            "total_tokens": None
        }

        async def token_stream() -> AsyncGenerator[str, None]:
            response_content = ""
            try:
                async for chunk in llm.astream(messages):
                    token = getattr(chunk, "content", None)
                    if token:
                        response_content += token
                        yield token

                    usage = None
                    if hasattr(chunk, "usage_metadata") and chunk.usage_metadata:
                        usage = chunk.usage_metadata
                    if not usage and hasattr(chunk, "response_metadata") and chunk.response_metadata:
                        usage = chunk.response_metadata.get("token_usage") or chunk.response_metadata.get("usage")
                    if usage:
                        stats["prompt_tokens"] = usage.get("prompt_tokens") or usage.get("input_tokens")
                        stats["completion_tokens"] = usage.get("completion_tokens") or usage.get("output_tokens")
                        stats["tokens_used"] = usage.get("total_tokens") or usage.get("total")
                        
                        # Calculate tokens_used from prompt + completion if available
                        if stats["prompt_tokens"] is not None and stats["completion_tokens"] is not None:
                            calculated_tokens = stats["prompt_tokens"] + stats["completion_tokens"]
                            # Use calculated value if total_tokens is not available or seems incorrect
                            if stats["tokens_used"] is None or stats["tokens_used"] == 0 or stats["tokens_used"] != calculated_tokens:
                                stats["tokens_used"] = calculated_tokens
            except Exception as e:
                await db.rollback()
                raise Exception(f"LLM Error: {str(e)}")

            # Save assistant response to history (no token usage for streaming)
            assistant_chat = ChatHistory(
                project_id=project_id,
                agent_version_id=agent_version.id,
                project_api_key_id=project_api_key_id,
                session_id=session_id,
                role="assistant",
                content=response_content,
                tokens_used=stats["tokens_used"],
                prompt_tokens=stats["prompt_tokens"],
                completion_tokens=stats["completion_tokens"],
                created_at=datetime.utcnow()
            )
            db.add(assistant_chat)
            await db.commit()

            if stats["tokens_used"] is not None:
                # Total tokens
                total_result = await db.execute(
                    select(func.sum(ChatHistory.tokens_used)).where(
                        ChatHistory.session_id == session_id,
                        ChatHistory.project_id == project_id
                    )
                )
                stats["total_tokens"] = total_result.scalar()
                
                # Total prompt tokens
                prompt_result = await db.execute(
                    select(func.sum(ChatHistory.prompt_tokens)).where(
                        ChatHistory.session_id == session_id,
                        ChatHistory.project_id == project_id,
                        ChatHistory.prompt_tokens.isnot(None)
                    )
                )
                stats["total_prompt_tokens"] = prompt_result.scalar()
                
                # Total completion tokens
                completion_result = await db.execute(
                    select(func.sum(ChatHistory.completion_tokens)).where(
                        ChatHistory.session_id == session_id,
                        ChatHistory.project_id == project_id,
                        ChatHistory.completion_tokens.isnot(None)
                    )
                )
                stats["total_completion_tokens"] = completion_result.scalar()

        return token_stream(), response_meta, stats
