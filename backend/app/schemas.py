from pydantic import BaseModel, Field, model_validator
from typing import Optional, List, Dict
from datetime import datetime
from uuid import UUID

# ============ Project Schemas ============

class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)

class ProjectLogin(BaseModel):
    username: str
    password: str

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: Optional[str]
    username: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

class ProjectWithStats(ProjectResponse):
    agents_count: int = 0
    api_keys_count: int = 0

# ============ API Key Schemas ============

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)

class APIKeyResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    api_key: str
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class APIKeyMasked(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    api_key_masked: str
    api_key: Optional[str] = None
    is_active: bool
    created_at: datetime
    last_used_at: Optional[datetime]

# ============ Agent Schemas ============

class AgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

class AgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class AgentResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    description: Optional[str]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# ============ Agent Version Schemas ============

class AgentVersionCreate(BaseModel):
    system_prompt: str = Field(..., min_length=1)
    model_name: str = Field(..., min_length=1, max_length=100)
    api_key: Optional[str] = Field(None, min_length=1)
    model_profile_id: Optional[UUID] = None
    base_url: Optional[str] = None
    temperature: float = Field(default=0.7, ge=0, le=2)
    max_tokens: int = Field(default=2048, ge=1, le=128000)
    top_p: float = Field(default=1.0, ge=0, le=1)
    frequency_penalty: float = Field(default=0.0, ge=-2, le=2)
    presence_penalty: float = Field(default=0.0, ge=-2, le=2)
    stop_sequences: Optional[List[str]] = None
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_source(self):
        if not self.api_key and not self.model_profile_id:
            raise ValueError("Either api_key or model_profile_id must be provided")
        return self

class AgentVersionResponse(BaseModel):
    id: UUID
    agent_id: UUID
    version_number: int
    system_prompt: str
    variables: List[str] = []
    model_name: str
    model_profile_id: Optional[UUID]
    model_profile_name: Optional[str] = None
    base_url: Optional[str]
    temperature: float
    max_tokens: int
    top_p: float
    frequency_penalty: float
    presence_penalty: float
    stop_sequences: Optional[List[str]]
    is_active: bool
    created_at: datetime
    notes: Optional[str]
    
    class Config:
        from_attributes = True

class AgentVersionCompare(BaseModel):
    version_1: AgentVersionResponse
    version_2: AgentVersionResponse
    differences: dict

class AgentWithVersions(AgentResponse):
    versions: List[AgentVersionResponse] = []
    active_version: Optional[AgentVersionResponse] = None

# ============ Model Profile Schemas ============

class ModelProfileCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=150)
    api_key: str = Field(..., min_length=1)
    base_url: Optional[str] = None

class ModelProfileUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=150)
    api_key: Optional[str] = Field(None, min_length=1)
    base_url: Optional[str] = Field(None)

class ModelProfileResponse(BaseModel):
    id: UUID
    project_id: UUID
    name: str
    base_url: Optional[str]
    api_key_masked: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class ModelProfileReveal(ModelProfileResponse):
    api_key: str

# ============ Chat Schemas ============

class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1)
    agent_name: str = Field(..., min_length=1)
    version_number: Optional[int] = None  # If None, use active version
    # Accept empty string as null to avoid UUID parsing errors from clients sending ""
    session_id: Optional[str] = None
    variables: Optional[Dict[str, str]] = None

    @model_validator(mode="before")
    def normalize_session_id(cls, values):
        sid = values.get("session_id")
        if sid == "":
            values["session_id"] = None
        return values

class ChatResponse(BaseModel):
    response: str
    session_id: UUID
    agent_name: str
    version_number: int
    model_name: Optional[str] = None
    tokens_used: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    total_tokens: Optional[int] = None
    total_prompt_tokens: Optional[int] = None
    total_completion_tokens: Optional[int] = None

class ChatHistoryResponse(BaseModel):
    id: UUID
    session_id: UUID
    project_api_key_id: Optional[UUID]
    role: str
    content: str
    tokens_used: Optional[int]
    created_at: datetime
    
    class Config:
        from_attributes = True

class ChatHistoryItem(BaseModel):
    id: UUID
    session_id: UUID
    agent_name: Optional[str] = None
    version_number: Optional[int] = None
    model_name: Optional[str] = None
    api_key_id: Optional[UUID] = None
    role: str
    content: str
    tokens_used: Optional[int] = None
    prompt_tokens: Optional[int] = None
    completion_tokens: Optional[int] = None
    created_at: datetime

# ============ Auth Schemas ============

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    project: ProjectResponse

class TokenData(BaseModel):
    project_id: Optional[UUID] = None
