import { useEffect, useMemo, useState } from 'react';
import { chatApi, agentsApi, apiKeysApi } from '../../api';
import { Search, Filter, RefreshCw, Clock, MessageSquare, Hash, Bot, ChevronRight, Copy } from 'lucide-react';
import { format, addHours } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';
import Modal from '../Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return format(addHours(date, 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId });
};

const ChatHistoryTab = () => {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [agents, setAgents] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [filters, setFilters] = useState({ agentId: '', versionNumber: '', apiKeyId: '', sessionId: '' });
  const [fetching, setFetching] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);

  useEffect(() => {
    const init = async () => {
      try {
        const [agentsRes, keysRes] = await Promise.all([
          agentsApi.list(),
          apiKeysApi.list(),
        ]);
        setAgents(agentsRes.data);
        setApiKeys(keysRes.data.filter(k => k.is_active));
      } catch (e) {
        toast.error('Gagal memuat data awal');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const loadHistory = async () => {
    setFetching(true);
    try {
      const params = {};
      if (filters.agentId) params.agent_id = filters.agentId;
      if (filters.versionNumber) params.version_number = Number(filters.versionNumber);
      if (filters.apiKeyId) params.api_key_id = filters.apiKeyId;
      if (filters.sessionId) params.session_id = filters.sessionId.trim();
      params.limit = 200;
      const res = await chatApi.listHistory(params);
      setHistory(res.data);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Gagal memuat riwayat');
    } finally {
      setFetching(false);
    }
  };

  const groupedHistory = useMemo(() => {
    const grouped = new Map();

    history.forEach((item) => {
      const bucket = grouped.get(item.session_id) || [];
      bucket.push(item);
      grouped.set(item.session_id, bucket);
    });

    return Array.from(grouped.entries()).map(([sessionId, items]) => {
      const sorted = [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      const first = sorted[0];
      const last = sorted[sorted.length - 1];

      // Calculate total tokens for the session
      const assistantMessages = sorted.filter(msg => msg.role === 'assistant');
      const totalTokens = assistantMessages.reduce((sum, msg) => sum + (msg.tokens_used || 0), 0);
      const totalPromptTokens = assistantMessages.reduce((sum, msg) => sum + (msg.prompt_tokens || 0), 0);
      const totalCompletionTokens = assistantMessages.reduce((sum, msg) => sum + (msg.completion_tokens || 0), 0);

      return {
        sessionId,
        agentName: first?.agent_name,
        versionNumber: first?.version_number,
        apiKeyId: first?.api_key_id,
        modelName: last?.model_name || first?.model_name,
        startedAt: first?.created_at,
        endedAt: last?.created_at,
        messages: sorted,
        totalMessages: sorted.length,
        totalTokens,
        totalPromptTokens,
        totalCompletionTokens,
      };
    }).sort((a, b) => new Date(b.endedAt || 0) - new Date(a.endedAt || 0));
  }, [history]);

  useEffect(() => {
    if (!loading) {
      loadHistory();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const copySessionId = async (sessionId) => {
    try {
      await navigator.clipboard.writeText(sessionId);
      toast.success('Session ID disalin');
    } catch (e) {
      toast.error('Gagal menyalin Session ID');
    }
  };

  const resetFilters = () => {
    setFilters({ agentId: '', versionNumber: '', apiKeyId: '', sessionId: '' });
    loadHistory();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-6xl mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1">
          <div>
            <label className="label">API Key</label>
            <select
              className="input"
              value={filters.apiKeyId}
              onChange={(e) => setFilters({ ...filters, apiKeyId: e.target.value })}
            >
              <option value="">Semua</option>
              {apiKeys.map((k) => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Agent</label>
            <select
              className="input"
              value={filters.agentId}
              onChange={(e) => setFilters({ ...filters, agentId: e.target.value, versionNumber: '' })}
            >
              <option value="">Semua</option>
              {agents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Versi</label>
            <select
              className="input"
              value={filters.versionNumber}
              onChange={(e) => setFilters({ ...filters, versionNumber: e.target.value })}
              disabled={!filters.agentId}
            >
              <option value="">Semua</option>
              {filters.agentId && agents.find(a => a.id === filters.agentId)?.versions?.map(v => (
                <option key={v.id} value={v.version_number}>Versi {v.version_number}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Session ID</label>
            <div className="flex gap-2">
              <input
                type="text"
                className="input flex-1"
                placeholder="Cari session_id"
                value={filters.sessionId}
                onChange={(e) => setFilters({ ...filters, sessionId: e.target.value })}
              />
              <button className="btn btn-ghost" onClick={resetFilters} title="Reset filter">
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={resetFilters}>
            <Filter className="w-4 h-4" /> Reset
          </button>
          <button className="btn btn-primary" onClick={loadHistory} disabled={fetching}>
            {fetching ? <LoadingSpinner size="sm" /> : <><Search className="w-4 h-4" /> Cari</>}
          </button>
        </div>
      </div>

      {groupedHistory.length === 0 ? (
        <div className="card p-8 text-center text-dark-500">
          <MessageSquare className="w-12 h-12 text-dark-300 mx-auto mb-3" />
          Tidak ada riwayat.
        </div>
      ) : (
        <div className="space-y-3">
          {groupedHistory.map((session) => {
            return (
              <div key={session.sessionId} className="card p-4 space-y-3">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div className="space-y-2 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-dark-500">
                      <Clock className="w-3 h-3" />
                      <span>{formatDateTime(session.startedAt)} → {formatDateTime(session.endedAt)}</span>
                      <span>• {session.totalMessages} pesan</span>
                      {session.totalTokens > 0 && (
                        <span>• Total {session.totalTokens} tokens</span>
                      )}
                    </div>
                    {session.totalTokens > 0 && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-dark-400">
                        <span>Prompt: {session.totalPromptTokens}</span>
                        <span>• Completion: {session.totalCompletionTokens}</span>
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-3 text-sm text-dark-800">
                      <span className="flex items-center gap-1"><Bot className="w-4 h-4" />{session.agentName || '-'}</span>
                      <span className="text-dark-500">v{session.versionNumber ?? '-'}</span>
                      {session.modelName && <span className="text-dark-400">• {session.modelName}</span>}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-dark-500 break-all">
                      <Hash className="w-3 h-3" />
                      <span className="truncate" title={session.sessionId}>{session.sessionId}</span>
                      <button
                        className="btn btn-ghost text-primary-600 px-2 py-1 h-auto"
                        onClick={() => copySessionId(session.sessionId)}
                        type="button"
                      >
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary self-start"
                    onClick={() => setSelectedSession(session)}
                  >
                    Lihat detail
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        isOpen={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        title={selectedSession ? `Detail Conversation • ${selectedSession.agentName || '-'}` : 'Detail Conversation'}
        size="full"
      >
        {selectedSession && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-sm text-dark-600">
              <div className="flex flex-wrap items-center gap-2">
                <Clock className="w-4 h-4" />
                <span>{formatDateTime(selectedSession.startedAt)} → {formatDateTime(selectedSession.endedAt)}</span>
                <span>• {selectedSession.totalMessages} pesan</span>
                {selectedSession.totalTokens > 0 && <span>• Total {selectedSession.totalTokens} tokens</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1"><Bot className="w-4 h-4" />{selectedSession.agentName || '-'}</span>
                <span>v{selectedSession.versionNumber ?? '-'}</span>
                {selectedSession.modelName && <span>• {selectedSession.modelName}</span>}
              </div>
            </div>
            {selectedSession.totalTokens > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs text-dark-400">
                <span>Prompt: {selectedSession.totalPromptTokens}</span>
                <span>• Completion: {selectedSession.totalCompletionTokens}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-dark-500 break-all">
              <Hash className="w-3 h-3" />
              <span className="truncate" title={selectedSession.sessionId}>{selectedSession.sessionId}</span>
              <button
                className="btn btn-ghost text-primary-600 px-2 py-1 h-auto"
                onClick={() => copySessionId(selectedSession.sessionId)}
                type="button"
              >
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>

            <div className="space-y-3">
              {selectedSession.messages.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-lg p-3 space-y-2 ${item.role === 'assistant' ? 'chat-message-assistant' : 'chat-message-user'}`}
                >
                  <div className={`flex items-center justify-between text-xs ${item.role === 'assistant' ? 'text-dark-500' : 'text-white/80'}`}>
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {formatDateTime(item.created_at)}
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full ${item.role === 'assistant' ? 'bg-primary-50 text-primary-700' : 'bg-white/20 text-white'}`}
                    >
                      {item.role}
                    </span>
                  </div>
                  <div className={`text-sm leading-relaxed ${item.role === 'assistant' ? 'text-dark-800' : 'text-white'}`}>
                    <div className="chat-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                        {item.content}
                      </ReactMarkdown>
                    </div>
                  </div>
                  <div className={`text-xs flex flex-wrap items-center gap-2 ${item.role === 'assistant' ? 'text-dark-400' : 'text-white/80'}`}>
                    {item.role === 'assistant' && (
                      <>
                        {item.model_name && <span>{item.model_name}</span>}
                        {item.tokens_used != null && <span>• {item.tokens_used} tokens</span>}
                        <span>• prompt {item.prompt_tokens ?? '-'}</span>
                        <span>• completion {item.completion_tokens ?? '-'}</span>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChatHistoryTab;
