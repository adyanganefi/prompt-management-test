-- ===========================================
-- PROMPT MANAGEMENT DATABASE INITIALIZATION
-- ===========================================

-- Create database (run this separately if needed)
-- CREATE DATABASE prompt_management;

-- Connect to the database first, then run the rest

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- PROJECTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    username VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- PROJECT API KEYS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS project_api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL UNIQUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP WITH TIME ZONE
);

-- ===========================================
-- MODEL PROFILES TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS model_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    base_url VARCHAR(500),
    api_key_encrypted TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

-- ===========================================
-- AGENTS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, name)
);

-- ===========================================
-- AGENT VERSIONS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS agent_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    system_prompt TEXT NOT NULL,
    model_name VARCHAR(100) NOT NULL,
    api_key_encrypted TEXT NOT NULL,
    model_profile_id UUID REFERENCES model_profiles(id) ON DELETE SET NULL,
    base_url VARCHAR(500),
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 2048,
    top_p DECIMAL(3,2) DEFAULT 1.0,
    frequency_penalty DECIMAL(3,2) DEFAULT 0.0,
    presence_penalty DECIMAL(3,2) DEFAULT 0.0,
    stop_sequences TEXT[],
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    UNIQUE(agent_id, version_number)
);

-- ===========================================
-- CHAT HISTORY TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS chat_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    agent_version_id UUID NOT NULL REFERENCES agent_versions(id) ON DELETE CASCADE,
    project_api_key_id UUID REFERENCES project_api_keys(id) ON DELETE SET NULL,
    session_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    tokens_used INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- INDEXES
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_project_api_keys_project_id ON project_api_keys(project_id);
CREATE INDEX IF NOT EXISTS idx_project_api_keys_api_key ON project_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_agents_project_id ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent_id ON agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_is_active ON agent_versions(is_active);
CREATE INDEX IF NOT EXISTS idx_chat_history_project_id ON chat_history(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_session_id ON chat_history(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_history_agent_version_id ON chat_history(agent_version_id);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Function to get next version number for an agent
CREATE OR REPLACE FUNCTION get_next_version_number(p_agent_id UUID)
RETURNS INTEGER AS $$
DECLARE
    next_version INTEGER;
BEGIN
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO next_version
    FROM agent_versions
    WHERE agent_id = p_agent_id;
    RETURN next_version;
END;
$$ LANGUAGE plpgsql;

-- Function to ensure only one active version per agent
CREATE OR REPLACE FUNCTION ensure_single_active_version()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_active = TRUE THEN
        UPDATE agent_versions
        SET is_active = FALSE
        WHERE agent_id = NEW.agent_id AND id != NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Trigger for updating updated_at on projects
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for updating updated_at on agents
DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
    BEFORE UPDATE ON agents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger to ensure only one active version per agent
DROP TRIGGER IF EXISTS ensure_single_active_version_trigger ON agent_versions;
CREATE TRIGGER ensure_single_active_version_trigger
    AFTER INSERT OR UPDATE OF is_active ON agent_versions
    FOR EACH ROW
    WHEN (NEW.is_active = TRUE)
    EXECUTE FUNCTION ensure_single_active_version();

-- ===========================================
-- INITIAL SETUP COMPLETE
-- ===========================================
