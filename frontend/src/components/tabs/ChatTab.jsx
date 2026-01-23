import { useState, useEffect, useRef } from 'react';
import { agentsApi, chatApi, apiKeysApi } from '../../api';
import { Send, Bot, User, Loader2, RefreshCw, MessageSquare, SlidersHorizontal } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import LoadingSpinner from '../LoadingSpinner';
import Modal from '../Modal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

const focusInput = (ref) => {
  if (ref?.current) {
    ref.current.focus();
  }
};

const toWIB = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const targetOffset = -420; // minutes for UTC+7
  const diffMinutes = targetOffset - date.getTimezoneOffset();
  return new Date(date.getTime() + diffMinutes * 60000);
};

const formatWIBTime = (value) => {
  if (!value) return '-';
  const wibDate = toWIB(value);
  if (!wibDate) return '-';
  return format(wibDate, 'HH:mm:ss', { locale: localeId });
};

const extractVariables = (prompt = '') => {
  const matches = prompt.match(/\$[A-Za-z_][A-Za-z0-9_]*/g) || [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
};

const ChatTab = () => {
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [selectedApiKey, setSelectedApiKey] = useState(null);
  const [selectedApiKeyValue, setSelectedApiKeyValue] = useState('');
  const [revealedKeys, setRevealedKeys] = useState({});
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [promptVariables, setPromptVariables] = useState([]);
  const [variableValues, setVariableValues] = useState({});
  const [showVariablesModal, setShowVariablesModal] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    fetchAgents();
    fetchApiKeys();
  }, []);

  useEffect(() => {
    focusInput(inputRef);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (!sending) {
      focusInput(inputRef);
    }
  }, [sending]);

  useEffect(() => {
    const vars = extractVariables(selectedVersion?.system_prompt || '');
    setPromptVariables(vars);
    setVariableValues((prev) => {
      const next = {};
      vars.forEach((name) => {
        if (prev[name]) next[name] = prev[name];
        else next[name] = '';
      });
      return next;
    });
  }, [selectedVersion]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const fetchAgents = async () => {
    try {
      const response = await agentsApi.list();
      setAgents(response.data);
      // Auto-select first agent with active version
      const agentWithActive = response.data.find(a => a.active_version);
      if (agentWithActive) {
        setSelectedAgent(agentWithActive);
        setSelectedVersion(agentWithActive.active_version);
      }
    } catch (error) {
      toast.error('Gagal memuat agents');
    } finally {
      setLoading(false);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const response = await apiKeysApi.list();
      const activeKeys = response.data.filter((k) => k.is_active);
      setApiKeys(activeKeys);
      if (activeKeys.length > 0) {
        // auto pilih key pertama dan reveal nilainya untuk bearer
        await handleApiKeyChange(activeKeys[0].id, activeKeys);
      } else {
        setSelectedApiKey(null);
        setSelectedApiKeyValue('');
      }
    } catch (error) {
      toast.error('Gagal memuat API keys');
    } finally {
      setApiKeysLoading(false);
    }
  };

  const handleAgentChange = (agentId) => {
    const agent = agents.find(a => a.id === agentId);
    setSelectedAgent(agent);
    setSelectedVersion(agent?.active_version || null);
    handleNewSession();
  };

  const handleVersionChange = (versionId) => {
    const version = selectedAgent?.versions?.find(v => v.id === versionId);
    setSelectedVersion(version);
    handleNewSession();
  };

  const handleApiKeyChange = async (apiKeyId, keys = apiKeys) => {
    const key = keys.find((k) => k.id === apiKeyId);
    setSelectedApiKey(key || null);
    setSelectedApiKeyValue('');
    handleNewSession();

    if (!key) return;

    // gunakan cache jika sudah di-reveal sebelumnya
    if (revealedKeys[key.id]) {
      setSelectedApiKeyValue(revealedKeys[key.id]);
      return;
    }

    try {
      const res = await apiKeysApi.reveal(key.id);
      const apiKeyPlain = res.data.api_key;
      setRevealedKeys(prev => ({ ...prev, [key.id]: apiKeyPlain }));
      setSelectedApiKeyValue(apiKeyPlain);
    } catch (error) {
      toast.error('Gagal mengambil API key. Coba klik Reveal di tab API Keys.');
    }
  };

  const handleNewSession = () => {
    setMessages([]);
    setSessionId(null);
    focusInput(inputRef);
  };

  const handleVariableChange = (name, value) => {
    setVariableValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!selectedApiKey) {
      toast.error('Pilih API key aktif terlebih dahulu');
      return;
    }

    if (!selectedApiKeyValue) {
      toast.error('API key belum di-reveal. Coba pilih/reveal ulang.');
      return;
    }

    if (!input.trim() || !selectedAgent || !selectedVersion || sending) return;

    const userMessage = input.trim();
    setInput('');
    setSending(true);
    focusInput(inputRef);

    const userMessageId = Date.now();
    const assistantMessageId = userMessageId + 1;

    // Add user message immediately
    setMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: userMessage,
      created_at: new Date().toISOString()
    }, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      created_at: null,
      streaming: true
    }]);

    try {
      await chatApi.stream({
        message: userMessage,
        agent_name: selectedAgent.name,
        version_number: selectedVersion?.version_number,
        session_id: sessionId,
        variables: promptVariables.length ? variableValues : undefined
      }, selectedApiKeyValue, {
        onStart: (payload) => {
          if (!sessionId && payload?.session_id) {
            setSessionId(payload.session_id);
          }
        },
        onToken: (payload) => {
          const token = payload?.token || '';
          if (!token) return;
          setMessages((prev) => prev.map((msg) => (
            msg.id === assistantMessageId
              ? {
                ...msg,
                content: `${msg.content}${token}`,
                created_at: msg.created_at || new Date().toISOString()
              }
              : msg
          )));
        },
        onDone: (payload) => {
          setMessages((prev) => prev.map((msg) => (
            msg.id === assistantMessageId
              ? {
                ...msg,
                streaming: false,
                tokens_used: payload?.tokens_used ?? payload?.total_tokens,
                prompt_tokens: payload?.prompt_tokens,
                completion_tokens: payload?.completion_tokens,
                model_name: payload?.model_name,
                created_at: msg.created_at || new Date().toISOString()
              }
              : msg
          )));
        },
        onError: (payload) => {
          const detail = payload?.detail || 'Gagal mengirim pesan (streaming).';
          toast.error(detail);
          setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
          setInput(userMessage);
        }
      });
      focusInput(inputRef);
    } catch (error) {
      try {
        const response = await chatApi.send({
          message: userMessage,
          agent_name: selectedAgent.name,
          version_number: selectedVersion?.version_number,
          session_id: sessionId,
          variables: promptVariables.length ? variableValues : undefined
        }, selectedApiKeyValue);

        if (!sessionId) {
          setSessionId(response.data.session_id);
        }

        setMessages(prev => prev.map((msg) => (
          msg.id === assistantMessageId
            ? {
              ...msg,
              content: response.data.response,
              streaming: false,
              tokens_used: response.data.tokens_used ?? response.data.total_tokens,
              prompt_tokens: response.data.prompt_tokens,
              completion_tokens: response.data.completion_tokens,
              model_name: response.data.model_name
            }
            : msg
        )));
        focusInput(inputRef);
      } catch (fallbackError) {
        toast.error(fallbackError.response?.data?.detail || 'Gagal mengirim pesan');
        setMessages((prev) => prev.filter((msg) => msg.id !== assistantMessageId));
        setInput(userMessage);
      }
      focusInput(inputRef);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (apiKeysLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (agents.length === 0) {
    return (
      <div className="card p-12 text-center">
        <MessageSquare className="w-16 h-16 text-dark-300 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-dark-700 mb-2">Belum ada Agent</h3>
        <p className="text-dark-500">Buat agent terlebih dahulu untuk mulai chat</p>
      </div>
    );
  }

  const hasStreaming = messages.some((message) => message.streaming);

  return (
    <div className="flex flex-col gap-4 max-w-6xl w-full mx-auto px-1 sm:px-0 flex-1 min-h-0 overflow-hidden">
      {/* Chat Header */}
      <div className="card p-4 flex-shrink-0">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_auto] gap-3 lg:gap-4 items-end">
          <div className="flex-1 min-w-0">
            <label className="label">Pilih API Key Aktif</label>
            <select
              className="input"
              value={selectedApiKey?.id || ''}
              onChange={(e) => handleApiKeyChange(e.target.value)}
            >
              <option value="">-- Pilih API Key --</option>
              {apiKeys.map((key) => (
                <option key={key.id} value={key.id}>
                  {key.name}
                </option>
              ))}
            </select>
            {apiKeys.length === 0 && (
              <p className="text-xs text-red-500 mt-1">Buat API key aktif untuk memulai percakapan.</p>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <label className="label">Pilih Agent</label>
            <select
              className="input"
              value={selectedAgent?.id || ''}
              onChange={(e) => handleAgentChange(e.target.value)}
            >
              <option value="">-- Pilih Agent --</option>
              {agents.map(agent => (
                <option key={agent.id} value={agent.id}>
                  {agent.name} {agent.active_version ? `(v${agent.active_version.version_number} aktif)` : '(tidak ada versi aktif)'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-w-0">
            <label className="label">Pilih Versi</label>
            <select
              className="input"
              value={selectedVersion?.id || ''}
              onChange={(e) => handleVersionChange(e.target.value)}
              disabled={!selectedAgent}
            >
              <option value="">-- Pilih Versi --</option>
              {selectedAgent?.versions?.map(version => (
                <option key={version.id} value={version.id}>
                  Versi {version.version_number} - {version.model_name}
                  {version.is_active ? ' (Aktif)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
            {promptVariables.length > 0 && (
              <button
                onClick={() => setShowVariablesModal(true)}
                className="btn btn-ghost inline-flex items-center gap-2"
                title="Isi variabel prompt (opsional)"
              >
                <SlidersHorizontal className="w-5 h-5" />
                <span className="text-sm font-medium">Isi Variabel</span>
                <span className="badge badge-gray text-[11px]">{promptVariables.length}</span>
              </button>
            )}
            <button
              onClick={() => {
                const ok = confirm('Mulai sesi baru? Riwayat chat pada layar akan direset.');
                if (ok) {
                  handleNewSession();
                  toast.success('Sesi baru dimulai');
                }
              }}
              className="btn btn-secondary"
              title="Sesi baru"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="card flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-dark-400">
                <Bot className="w-16 h-16 mx-auto mb-4 text-dark-300" />
                <p className="text-lg font-medium">Mulai percakapan</p>
                <p className="text-sm mt-1">
                  {selectedAgent && selectedVersion 
                    ? `Chat dengan ${selectedAgent.name} v${selectedVersion.version_number}`
                    : 'Pilih agent dan versi untuk memulai'}
                </p>
              </div>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex items-start gap-3 max-w-[92%] sm:max-w-[82%] lg:max-w-[70%] ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    message.role === 'user' ? 'bg-primary-600' : 'bg-dark-200'
                  }`}>
                    {message.role === 'user' ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-dark-600" />
                    )}
                  </div>
                  <div>
                    <div className={`px-4 py-3 ${
                      message.role === 'user' 
                        ? 'chat-message-user' 
                        : 'chat-message-assistant'
                    }`}>
                      <div className="chat-markdown">
                        <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                          {message.content}
                        </ReactMarkdown>
                      </div>
                      {message.streaming && (
                        <div className="mt-2 flex items-center gap-2 text-xs text-dark-400">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Mengetik...</span>
                        </div>
                      )}
                    </div>
                    <div className={`flex items-center gap-2 mt-1 text-xs text-dark-400 ${
                      message.role === 'user' ? 'justify-end' : ''
                    }`}>
                      <span>{formatWIBTime(message.created_at)}</span>
                      {message.role === 'assistant' && (
                        <span className="text-dark-300">
                          {message.tokens_used != null && <>• {message.tokens_used} tokens </>}
                          <>• prompt {message.prompt_tokens ?? '-'} </>
                          <>• completion {message.completion_tokens ?? '-'} </>
                          {message.model_name && <>• {message.model_name}</>}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
          {sending && !hasStreaming && (
            <div className="flex justify-start">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-dark-200 flex items-center justify-center">
                  <Bot className="w-4 h-4 text-dark-600" />
                </div>
                <div className="chat-message-assistant px-4 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-dark-400" />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="border-t border-dark-100 p-4">
          <form onSubmit={handleSend} className="flex gap-3">
            <input
              type="text"
              className="input flex-1 min-w-0"
              placeholder={selectedAgent && selectedVersion && selectedApiKey ? "Ketik pesan Anda..." : "Pilih API key, agent, dan versi terlebih dahulu"}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={!selectedAgent || !selectedVersion || !selectedApiKey || sending}
              ref={inputRef}
            />
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!input.trim() || !selectedAgent || !selectedVersion || !selectedApiKey || sending}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </form>
        </div>
      </div>

      <Modal
        isOpen={showVariablesModal}
        onClose={() => setShowVariablesModal(false)}
        title="Variabel Prompt (opsional)"
      >
        {promptVariables.length === 0 ? (
          <p className="text-sm text-dark-500">Tidak ada variabel pada prompt aktif.</p>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-dark-600">Isi jika ingin mengganti placeholder di system prompt. Jika dibiarkan kosong, placeholder tetap apa adanya.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {promptVariables.map((name) => (
                <div key={name}>
                  <label className="label text-xs">
                    {`$${name}`} <span className="text-dark-400">(opsional)</span>
                  </label>
                  <input
                    className="input"
                    value={variableValues[name] || ''}
                    onChange={(e) => handleVariableChange(name, e.target.value)}
                    placeholder={`Masukkan nilai untuk ${name}`}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button className="btn btn-secondary" onClick={() => {
                setVariableValues((prev) => {
                  const next = { ...prev };
                  promptVariables.forEach((name) => { next[name] = ''; });
                  return next;
                });
              }}>
                Kosongkan
              </button>
              <button className="btn btn-primary" onClick={() => setShowVariablesModal(false)}>
                Selesai
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ChatTab;
