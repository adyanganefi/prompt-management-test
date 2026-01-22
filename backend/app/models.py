import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Boolean, Integer, Numeric, ARRAY, ForeignKey, DateTime, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.database import Base

class Project(Base):
    __tablename__ = "projects"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    username = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    api_keys = relationship("ProjectAPIKey", back_populates="project", cascade="all, delete-orphan")
    agents = relationship("Agent", back_populates="project", cascade="all, delete-orphan")
    chat_history = relationship("ChatHistory", back_populates="project", cascade="all, delete-orphan")
    model_profiles = relationship("ModelProfile", back_populates="project", cascade="all, delete-orphan")

class ProjectAPIKey(Base):
    __tablename__ = "project_api_keys"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    api_key = Column(String(255), nullable=False, unique=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    last_used_at = Column(DateTime(timezone=True))
    
    # Relationships
    project = relationship("Project", back_populates="api_keys")
    chat_history = relationship("ChatHistory", back_populates="api_key")


class ModelProfile(Base):
    __tablename__ = "model_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(150), nullable=False)
    base_url = Column(String(500))
    api_key_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    project = relationship("Project", back_populates="model_profiles")
    agent_versions = relationship("AgentVersion", back_populates="model_profile")

class Agent(Base):
    __tablename__ = "agents"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    project = relationship("Project", back_populates="agents")
    versions = relationship("AgentVersion", back_populates="agent", cascade="all, delete-orphan", order_by="AgentVersion.version_number.desc()")

class AgentVersion(Base):
    __tablename__ = "agent_versions"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    agent_id = Column(UUID(as_uuid=True), ForeignKey("agents.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    system_prompt = Column(Text, nullable=False)
    model_name = Column(String(100), nullable=False)
    api_key_encrypted = Column(Text, nullable=False)
    model_profile_id = Column(UUID(as_uuid=True), ForeignKey("model_profiles.id", ondelete="SET NULL"))
    base_url = Column(String(500))
    temperature = Column(Numeric(3, 2), default=0.7)
    max_tokens = Column(Integer, default=2048)
    top_p = Column(Numeric(3, 2), default=1.0)
    frequency_penalty = Column(Numeric(3, 2), default=0.0)
    presence_penalty = Column(Numeric(3, 2), default=0.0)
    stop_sequences = Column(ARRAY(Text))
    is_active = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    notes = Column(Text)
    
    # Relationships
    agent = relationship("Agent", back_populates="versions")
    chat_history = relationship("ChatHistory", back_populates="agent_version", cascade="all, delete-orphan")
    model_profile = relationship("ModelProfile", back_populates="agent_versions")

class ChatHistory(Base):
    __tablename__ = "chat_history"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    agent_version_id = Column(UUID(as_uuid=True), ForeignKey("agent_versions.id", ondelete="CASCADE"), nullable=False)
    project_api_key_id = Column(UUID(as_uuid=True), ForeignKey("project_api_keys.id", ondelete="SET NULL"))
    session_id = Column(UUID(as_uuid=True), nullable=False)
    role = Column(String(20), nullable=False)
    content = Column(Text, nullable=False)
    tokens_used = Column(Integer)
    prompt_tokens = Column(Integer)
    completion_tokens = Column(Integer)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    
    __table_args__ = (
        CheckConstraint(role.in_(['user', 'assistant', 'system']), name='check_role'),
    )
    
    # Relationships
    project = relationship("Project", back_populates="chat_history")
    agent_version = relationship("AgentVersion", back_populates="chat_history")
    api_key = relationship("ProjectAPIKey", back_populates="chat_history")
