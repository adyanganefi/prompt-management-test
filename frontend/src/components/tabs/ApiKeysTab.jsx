import { useState, useEffect } from 'react';
import { apiKeysApi } from '../../api';
import { Plus, Key, Eye, EyeOff, Copy, Trash2, ToggleLeft, ToggleRight, Clock, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { addHours } from 'date-fns';
import Modal from '../Modal';
import LoadingSpinner from '../LoadingSpinner';
import { useAuth } from '../../context/AuthContext';

const ApiKeysTab = () => {
  const [apiKeys, setApiKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedKeys, setRevealedKeys] = useState({});
  const [loadingKeys, setLoadingKeys] = useState({});
  const { refreshUser } = useAuth();

  useEffect(() => {
    fetchApiKeys();
  }, []);

  const fetchApiKeys = async () => {
    try {
      const response = await apiKeysApi.list();
      setApiKeys(response.data);
      refreshUser();
    } catch (error) {
      toast.error('Gagal memuat API keys');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newKeyName.trim()) return;
    
    setCreating(true);
    try {
      const response = await apiKeysApi.create({ name: newKeyName });
      toast.success('API key berhasil dibuat!');
      setRevealedKeys(prev => ({ ...prev, [response.data.id]: response.data.api_key }));
      setShowCreate(false);
      setNewKeyName('');
      fetchApiKeys();
      refreshUser();
    } catch (error) {
      toast.error('Gagal membuat API key');
    } finally {
      setCreating(false);
    }
  };

  const handleReveal = async (keyId) => {
    if (revealedKeys[keyId]) {
      setRevealedKeys(prev => {
        const updated = { ...prev };
        delete updated[keyId];
        return updated;
      });
      return;
    }

    setLoadingKeys(prev => ({ ...prev, [keyId]: true }));
    try {
      const response = await apiKeysApi.reveal(keyId);
      setRevealedKeys(prev => ({ ...prev, [keyId]: response.data.api_key }));
    } catch (error) {
      toast.error('Gagal mengungkap API key');
    } finally {
      setLoadingKeys(prev => ({ ...prev, [keyId]: false }));
    }
  };

  const handleCopy = (key) => {
    navigator.clipboard.writeText(key);
    toast.success('API key disalin ke clipboard');
  };

  const handleToggle = async (keyId) => {
    try {
      await apiKeysApi.toggle(keyId);
      fetchApiKeys();
      toast.success('Status API key diperbarui');
      refreshUser();
    } catch (error) {
      toast.error('Gagal mengubah status API key');
    }
  };

  const handleDelete = async (keyId) => {
    if (!confirm('Yakin ingin menghapus API key ini?')) return;
    
    try {
      await apiKeysApi.delete(keyId);
      toast.success('API key berhasil dihapus');
      fetchApiKeys();
      refreshUser();
    } catch (error) {
      toast.error('Gagal menghapus API key');
    }
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
          <h2 className="text-2xl font-bold text-dark-900">API Keys</h2>
          <p className="text-dark-500 mt-1">Kelola API keys untuk mengakses chat endpoint</p>
        </div>
        <button 
          onClick={() => setShowCreate(true)}
          className="btn btn-primary"
        >
          <Plus className="w-5 h-5" />
          Generate API Key
        </button>
      </div>

      {/* Info Box */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4">
        <h4 className="font-medium text-primary-800 mb-2">💡 Cara Penggunaan API Key</h4>
        <p className="text-sm text-primary-700">
          Gunakan API key sebagai Bearer token saat melakukan request ke endpoint chat.
          Contoh header: <code className="bg-primary-100 px-2 py-0.5 rounded">Authorization: Bearer pm_xxx...</code>
        </p>
      </div>

      {/* API Keys List */}
      {apiKeys.length === 0 ? (
        <div className="card p-12 text-center">
          <Key className="w-16 h-16 text-dark-300 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-dark-700 mb-2">Belum ada API Key</h3>
          <p className="text-dark-500 mb-6">Generate API key untuk mengakses chat melalui API</p>
          <button 
            onClick={() => setShowCreate(true)}
            className="btn btn-primary mx-auto"
          >
            <Plus className="w-5 h-5" />
            Generate API Key Pertama
          </button>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden hidden lg:block">
            <div className="overflow-x-auto max-w-full">
              <table className="w-full min-w-[960px] table-fixed">
                <colgroup>
                  <col className="w-48" />
                  <col className="w-[360px]" />
                  <col className="w-32" />
                  <col className="w-40" />
                  <col className="w-48" />
                  <col className="w-20" />
                </colgroup>
                <thead className="bg-dark-50 border-b border-dark-100">
                  <tr>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-dark-600">Nama</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-dark-600">API Key</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-dark-600">Status</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-dark-600">Dibuat</th>
                    <th className="text-left px-6 py-4 text-sm font-semibold text-dark-600">Terakhir Digunakan</th>
                    <th className="text-right px-6 py-4 text-sm font-semibold text-dark-600">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-100">
                  {apiKeys.map((key) => (
                    <tr key={key.id} className="hover:bg-dark-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap max-w-[220px]">
                        <span className="font-medium text-dark-900 truncate block" title={key.name}>{key.name}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="bg-dark-100 px-3 py-1 rounded-lg text-sm font-mono truncate inline-block max-w-[320px]" title={revealedKeys[key.id] || key.api_key_masked}>
                            {revealedKeys[key.id] || key.api_key_masked}
                          </span>
                          <button
                            onClick={() => handleReveal(key.id)}
                            className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
                            disabled={loadingKeys[key.id]}
                          >
                            {loadingKeys[key.id] ? (
                              <LoadingSpinner size="sm" />
                            ) : revealedKeys[key.id] ? (
                              <EyeOff className="w-4 h-4 text-dark-500" />
                            ) : (
                              <Eye className="w-4 h-4 text-dark-500" />
                            )}
                          </button>
                          {revealedKeys[key.id] && (
                            <button
                              onClick={() => handleCopy(revealedKeys[key.id])}
                              className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
                            >
                              <Copy className="w-4 h-4 text-dark-500" />
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <button
                          onClick={() => handleToggle(key.id)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            key.is_active 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-dark-100 text-dark-500 hover:bg-dark-200'
                          }`}
                        >
                          {key.is_active ? (
                            <>
                              <ToggleRight className="w-4 h-4" />
                              Aktif
                            </>
                          ) : (
                            <>
                              <ToggleLeft className="w-4 h-4" />
                              Nonaktif
                            </>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-500 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {format(addHours(new Date(key.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-dark-500 whitespace-nowrap">
                        {key.last_used_at ? (
                          <div className="flex items-center gap-1">
                            <CheckCircle className="w-4 h-4 text-green-500" />
                            {format(addHours(new Date(key.last_used_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                          </div>
                        ) : (
                          <span className="text-dark-400">Belum pernah</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDelete(key.id)}
                          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid gap-4 lg:hidden">
            {apiKeys.map((key) => (
              <div key={key.id} className="card p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1 min-w-0">
                    <p className="text-xs text-dark-500">Nama</p>
                    <p className="font-semibold text-dark-900 truncate">{key.name}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(key.id)}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-dark-500">API Key</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="bg-dark-100 px-3 py-1 rounded-lg text-sm font-mono truncate inline-block max-w-full" title={revealedKeys[key.id] || key.api_key_masked}>
                      {revealedKeys[key.id] || key.api_key_masked}
                    </span>
                    <button
                      onClick={() => handleReveal(key.id)}
                      className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
                      disabled={loadingKeys[key.id]}
                    >
                      {loadingKeys[key.id] ? (
                        <LoadingSpinner size="sm" />
                      ) : revealedKeys[key.id] ? (
                        <EyeOff className="w-4 h-4 text-dark-500" />
                      ) : (
                        <Eye className="w-4 h-4 text-dark-500" />
                      )}
                    </button>
                    {revealedKeys[key.id] && (
                      <button
                        onClick={() => handleCopy(revealedKeys[key.id])}
                        className="p-1.5 hover:bg-dark-100 rounded-lg transition-colors"
                      >
                        <Copy className="w-4 h-4 text-dark-500" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <button
                    onClick={() => handleToggle(key.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                      key.is_active 
                        ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                        : 'bg-dark-100 text-dark-500 hover:bg-dark-200'
                    }`}
                  >
                    {key.is_active ? (
                      <>
                        <ToggleRight className="w-4 h-4" />
                        Aktif
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4" />
                        Nonaktif
                      </>
                    )}
                  </button>

                  <div className="flex items-center gap-1 text-dark-500">
                    <Clock className="w-4 h-4" />
                    {format(addHours(new Date(key.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                  </div>

                  <div className="flex items-center gap-1 text-dark-500">
                    {key.last_used_at ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        {format(addHours(new Date(key.last_used_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId })}
                      </>
                    ) : (
                      <span className="text-dark-400">Belum pernah</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Create Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate API Key Baru"
        size="sm"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="label">Nama API Key</label>
            <input
              type="text"
              className="input"
              placeholder="Contoh: Production Key"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              required
            />
            <p className="text-xs text-dark-400 mt-1">
              Berikan nama yang mudah diingat untuk identifikasi
            </p>
          </div>
          
          <div className="flex gap-3 pt-4">
            <button 
              type="button"
              onClick={() => setShowCreate(false)}
              className="btn btn-secondary flex-1"
            >
              Batal
            </button>
            <button 
              type="submit"
              className="btn btn-primary flex-1"
              disabled={creating}
            >
              {creating ? <LoadingSpinner size="sm" /> : 'Generate'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ApiKeysTab;
