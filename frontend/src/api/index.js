import axios from 'axios';

// Allow overriding base URL (useful when dev proxy tidak jalan atau saat preview/production)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 20000,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  // Jika Authorization sudah di-set (mis. mau pakai Project API Key), jangan ditimpa token login
  if (config.headers && config.headers.Authorization) {
    return config;
  }

  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('project');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authApi = {
  register: (data) => api.post('/projects/register', data),
  login: (data) => api.post('/projects/login', data),
  getMe: () => api.get('/projects/me'),
  updateProject: (data) => api.put('/projects/me', data),
  deleteProject: () => api.delete('/projects/me'),
};

// API Keys API
export const apiKeysApi = {
  list: () => api.get('/api-keys'),
  create: (data) => api.post('/api-keys', data),
  reveal: (id) => api.get(`/api-keys/${id}/reveal`),
  toggle: (id) => api.patch(`/api-keys/${id}/toggle`),
  delete: (id) => api.delete(`/api-keys/${id}`),
};

// Agents API
export const agentsApi = {
  list: () => api.get('/agents'),
  get: (id) => api.get(`/agents/${id}`),
  create: (data) => api.post('/agents', data),
  update: (id, data) => api.put(`/agents/${id}`, data),
  delete: (id) => api.delete(`/agents/${id}`),
  
  // Versions
  listVersions: (agentId) => api.get(`/agents/${agentId}/versions`),
  getVersion: (agentId, versionId) => api.get(`/agents/${agentId}/versions/${versionId}`),
  createVersion: (agentId, data) => api.post(`/agents/${agentId}/versions`, data),
  activateVersion: (agentId, versionId) => api.patch(`/agents/${agentId}/versions/${versionId}/activate`),
  deleteVersion: (agentId, versionId) => api.delete(`/agents/${agentId}/versions/${versionId}`),
  compareVersions: (agentId, v1, v2) => api.get(`/agents/${agentId}/versions/compare`, {
    params: {
      version1: Number(v1),
      version2: Number(v2)
    }
  }),
};

// Chat API
export const chatApi = {
  send: (data, projectApiKey) => api.post('/chat', data, {
    headers: {
      // Override auth header: chat endpoint wajib pakai Project API Key sebagai bearer
      Authorization: `Bearer ${projectApiKey}`
    },
    // No timeout for chat requests
    timeout: 0
  }),
  stream: async (data, projectApiKey, { onStart, onToken, onDone, onError, signal } = {}) => {
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${projectApiKey}`
      },
      body: JSON.stringify(data),
      signal
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || 'Streaming request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('Streaming not supported');

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    const handleEvent = (block) => {
      const lines = block.split('\n').filter(Boolean);
      let eventName = 'message';
      let data = '';
      for (const line of lines) {
        if (line.startsWith('event:')) {
          eventName = line.replace('event:', '').trim();
        } else if (line.startsWith('data:')) {
          data += line.replace('data:', '').trim();
        }
      }
      if (!data) return;
      let payload = null;
      try {
        payload = JSON.parse(data);
      } catch (e) {
        payload = { raw: data };
      }
      if (eventName === 'start') onStart?.(payload);
      if (eventName === 'token') onToken?.(payload);
      if (eventName === 'done') onDone?.(payload);
      if (eventName === 'error') onError?.(payload);
    };

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split('\n\n');
      buffer = parts.pop() || '';
      parts.forEach(handleEvent);
    }
  },
  getHistory: (sessionId) => api.get(`/chat/history/${sessionId}`),
  listHistory: (params) => api.get('/chat/history', { params }),
  getSessions: (agentId) => api.get(`/chat/sessions${agentId ? `?agent_id=${agentId}` : ''}`),
  deleteHistory: (sessionId) => api.delete(`/chat/history/${sessionId}`),
};

// Model Profiles API
export const modelProfilesApi = {
  list: () => api.get('/model-profiles'),
  create: (data) => api.post('/model-profiles', data),
  update: (id, data) => api.patch(`/model-profiles/${id}`, data),
  delete: (id) => api.delete(`/model-profiles/${id}`),
  reveal: (id) => api.get(`/model-profiles/${id}/reveal`),
};

export default api;
