import { useState, useEffect } from 'react';
import { agentsApi } from '../../api';
import { 
  Plus, Bot, ChevronDown, ChevronUp, Play, Trash2, 
  Clock, CheckCircle2, AlertCircle, FileText, GitBranch, Eye
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addHours } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import Modal from '../Modal';
import LoadingSpinner from '../LoadingSpinner';
import CreateAgentForm from '../forms/CreateAgentForm';
import CreateVersionForm from '../forms/CreateVersionForm';
import VersionCompareModal from '../VersionCompareModal';
import { useAuth } from '../../context/AuthContext';

const AgentsTab = () => {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedAgentId, setExpandedAgentId] = useState(null);
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [showCreateVersion, setShowCreateVersion] = useState(null);
  const [showCompare, setShowCompare] = useState(null);
  const [selectedVersions, setSelectedVersions] = useState({});
  const [expandedVersionDetails, setExpandedVersionDetails] = useState({});
  const { refreshUser } = useAuth();

  useEffect(() => {
    fetchAgents();
  }, []);

  const fetchAgents = async () => {
    try {
      const response = await agentsApi.list();
      setAgents(response.data);
      refreshUser();
    } catch (error) {
      toast.error('Gagal memuat agents');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (agentId) => {
    setExpandedAgentId(prev => (prev === agentId ? null : agentId));
  };

  const handleActivateVersion = async (agentId, versionId) => {
    try {
      await agentsApi.activateVersion(agentId, versionId);
      toast.success('Versi berhasil diaktifkan!');
      fetchAgents();
      refreshUser();
    } catch (error) {
      toast.error('Gagal mengaktifkan versi');
    }
  };

  const handleDeleteAgent = async (agentId) => {
    if (!confirm('Yakin ingin menghapus agent beserta semua versinya?')) return;
    
    try {
      await agentsApi.delete(agentId);
      toast.success('Agent berhasil dihapus');
      fetchAgents();
      refreshUser();
    } catch (error) {
      toast.error('Gagal menghapus agent');
    }
  };

  const handleVersionSelect = (agentId, versionNumber) => {
    setSelectedVersions(prev => {
      const current = prev[agentId] || [];
      if (current.includes(versionNumber)) {
        return { ...prev, [agentId]: current.filter(v => v !== versionNumber) };
      }
      if (current.length >= 2) {
        return { ...prev, [agentId]: [current[1], versionNumber] };
      }
      return { ...prev, [agentId]: [...current, versionNumber] };
    });
  };

  const toggleVersionDetails = (agentId, versionId) => {
    setExpandedVersionDetails(prev => ({
      ...prev,
      [agentId]: prev[agentId] === versionId ? null : versionId
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-900">Agents</h2>
          <p className="text-dark-500 mt-1">Kelola AI agents dan versi prompt Anda</p>
        </div>
        <button 
          onClick={() => setShowCreateAgent(true)}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5" />
          Buat Agent
        </button>
      </div>

      {/* Agents List */}
      {agents.length === 0 ? (
        <div className="card p-12 text-center">
          <Bot className="w-16 h-16 text-dark-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-700 mb-2">Belum ada Agent</h3>
          <p className="text-dark-500 mb-6">Buat agent pertama Anda untuk mulai mengelola AI prompts</p>
          <button 
            onClick={() => setShowCreateAgent(true)}
            className="btn btn-primary mx-auto"
          >
            <Plus className="w-5 h-5" />
            Buat Agent Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {agents.map((agent) => (
            <div key={agent.id} className="card overflow-hidden">
              {/* Agent Header */}
              <div 
                className="px-6 py-4 flex items-center justify-between cursor-pointer hover:bg-dark-50 transition-colors"
                onClick={() => toggleExpand(agent.id)}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                    <Bot className="w-6 h-6 text-primary-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-dark-900">{agent.name}</h3>
                    <p className="text-sm text-dark-500">{agent.description || 'Tidak ada deskripsi'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="hidden sm:flex items-center gap-3">
                    <span className="badge badge-gray">
                      <GitBranch className="w-3 h-3 mr-1" />
                      {agent.versions?.length || 0} versi
                    </span>
                    {agent.active_version && (
                      <span className="badge badge-success">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        v{agent.active_version.version_number} aktif
                      </span>
                    )}
                  </div>
                  {expandedAgentId === agent.id ? (
                    <ChevronUp className="w-5 h-5 text-dark-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-dark-400" />
                  )}
                </div>
              </div>

              {/* Agent Expanded Content */}
              {expandedAgentId === agent.id && (
                <div className="border-t border-dark-100">
                  {/* Action Bar */}
                  <div className="px-6 py-3 bg-dark-50 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setShowCreateVersion({ agentId: agent.id, versions: agent.versions })}
                        className="btn btn-sm btn-primary"
                      >
                        <Plus className="w-4 h-4" />
                        Versi Baru
                      </button>
                      {selectedVersions[agent.id]?.length === 2 && (
                        <button
                          onClick={() => setShowCompare({
                            agentId: agent.id,
                            v1: selectedVersions[agent.id][0],
                            v2: selectedVersions[agent.id][1]
                          })}
                          className="btn btn-sm btn-secondary"
                        >
                          <Eye className="w-4 h-4" />
                          Bandingkan
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteAgent(agent.id)}
                      className="btn btn-sm btn-ghost text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus Agent
                    </button>
                  </div>

                  {/* Versions List */}
                  <div className="p-6">
                    {!agent.versions?.length ? (
                      <div className="text-center py-8 text-dark-500">
                        <FileText className="w-10 h-10 mx-auto mb-2 text-dark-300" />
                        <p>Belum ada versi. Buat versi pertama untuk agent ini.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedVersions[agent.id]?.length > 0 && (
                          <p className="text-sm text-dark-500 mb-2">
                            Pilih 2 versi untuk membandingkan ({selectedVersions[agent.id]?.length || 0}/2 terpilih)
                          </p>
                        )}
                        {agent.versions.map((version) => (
                          <div 
                            key={version.id}
                            className={`
                              border rounded-xl p-4 transition-all
                              ${version.is_active ? 'border-green-300 bg-green-50' : 'border-dark-200 hover:border-dark-300'}
                              ${selectedVersions[agent.id]?.includes(version.version_number) ? 'ring-2 ring-primary-500' : ''}
                            `}
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                              <div className="flex items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={selectedVersions[agent.id]?.includes(version.version_number) || false}
                                  onChange={() => handleVersionSelect(agent.id, version.version_number)}
                                  className="mt-1 w-4 h-4 rounded border-dark-300 text-primary-600 focus:ring-primary-500"
                                />
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold text-dark-900">
                                      {agent.name} (Versi {version.version_number})
                                    </span>
                                    {version.is_active && (
                                      <span className="badge badge-success">
                                        <CheckCircle2 className="w-3 h-3 mr-1" />
                                        Aktif
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-sm text-dark-500 mt-1">
                                    Model: <span className="font-medium">{version.model_name}</span>
                                  </p>
                                  <p className="text-sm text-dark-400 mt-1 line-clamp-2">
                                    {version.system_prompt.substring(0, 150)}
                                    {version.system_prompt.length > 150 && '...'}
                                  </p>
                                  <div className="flex items-center gap-4 mt-2 text-xs text-dark-400">
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {format(addHours(new Date(version.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                                    </span>
                                    {version.notes && (
                                      <span className="text-dark-500">
                                        📝 {version.notes.substring(0, 50)}{version.notes.length > 50 && '...'}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 ml-7 sm:ml-0">
                                <button
                                  onClick={() => toggleVersionDetails(agent.id, version.id)}
                                  className="btn btn-sm btn-ghost"
                                >
                                  <Eye className="w-4 h-4" />
                                  {expandedVersionDetails[agent.id] === version.id ? 'Tutup Detail' : 'Lihat Detail'}
                                </button>
                                {!version.is_active && (
                                  <button
                                    onClick={() => handleActivateVersion(agent.id, version.id)}
                                    className="btn btn-sm btn-secondary"
                                  >
                                    <Play className="w-4 h-4" />
                                    Aktifkan
                                  </button>
                                )}
                              </div>
                            </div>
                            {expandedVersionDetails[agent.id] === version.id && (
                              <div className="mt-4 border-t border-dark-100 pt-4 grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm text-dark-700">
                                <div className="space-y-2">
                                  <p className="break-words"><span className="font-medium">Model Profile:</span> {version.model_profile_name || version.model_profile?.name || '(none)'}</p>
                                  <p className="break-words"><span className="font-medium">Base URL:</span> <span className="break-all">{version.base_url || '(default)'}</span></p>
                                  <p className="break-words"><span className="font-medium">Model:</span> {version.model_name}</p>
                                  <p><span className="font-medium">Temperature:</span> {version.temperature}</p>
                                  <p><span className="font-medium">Max Tokens:</span> {version.max_tokens}</p>
                                  <p><span className="font-medium">Top P:</span> {version.top_p}</p>
                                  <p><span className="font-medium">Freq. Penalty:</span> {version.frequency_penalty}</p>
                                  <p><span className="font-medium">Presence Penalty:</span> {version.presence_penalty}</p>
                                  <p className="break-words"><span className="font-medium">Stop Sequences:</span> {version.stop_sequences?.join(', ') || '(none)'}</p>
                                </div>
                                <div className="space-y-2">
                                  <p className="font-medium">System Prompt</p>
                                  <div className="text-dark-600 whitespace-pre-wrap bg-dark-50 rounded-lg p-3 border border-dark-100 max-h-64 overflow-auto break-words">
                                    {version.system_prompt}
                                  </div>
                                  {version.notes && (
                                    <div>
                                      <p className="font-medium mt-2">Catatan</p>
                                      <div className="text-dark-600 whitespace-pre-wrap bg-dark-50 rounded-lg p-3 border border-dark-100 max-h-48 overflow-auto break-words">
                                        {version.notes}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Agent Modal */}
      <Modal
        isOpen={showCreateAgent}
        onClose={() => setShowCreateAgent(false)}
        title="Buat Agent Baru"
      >
        <CreateAgentForm 
          onSuccess={() => {
            setShowCreateAgent(false);
            fetchAgents();
            refreshUser();
          }}
          onCancel={() => setShowCreateAgent(false)}
        />
      </Modal>

      {/* Create Version Modal */}
      <Modal
        isOpen={!!showCreateVersion}
        onClose={() => setShowCreateVersion(null)}
        title="Buat Versi Baru"
        size="xl"
      >
        {showCreateVersion && (
          <CreateVersionForm 
            agentId={showCreateVersion.agentId}
            versions={agents.find(a => a.id === showCreateVersion.agentId)?.versions || showCreateVersion.versions || []}
            onSuccess={() => {
              setShowCreateVersion(null);
              fetchAgents();
              refreshUser();
            }}
            onCancel={() => setShowCreateVersion(null)}
          />
        )}
      </Modal>

      {/* Version Compare Modal */}
      <VersionCompareModal
        isOpen={!!showCompare}
        onClose={() => {
          setShowCompare(null);
          setSelectedVersions(prev => ({ ...prev, [showCompare?.agentId]: [] }));
        }}
        agentId={showCompare?.agentId}
        v1={showCompare?.v1}
        v2={showCompare?.v2}
      />
    </div>
  );
};

export default AgentsTab;
