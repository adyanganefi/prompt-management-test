import { useState, useEffect } from 'react';
import { agentsApi, modelProfilesApi } from '../../api';
import { ChevronDown, ChevronUp, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';

const CreateVersionForm = ({ agentId, versions = [], onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    system_prompt: '',
    model_name: 'gpt-4o-mini',
    model_profile_id: '',
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stop_sequences: '',
    notes: ''
  });
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);
  const [changes, setChanges] = useState([]);
  const [baseVersionId, setBaseVersionId] = useState(null);
  const [baseInitialized, setBaseInitialized] = useState(false);
  const [profiles, setProfiles] = useState([]);
  const [profilesLoading, setProfilesLoading] = useState(true);

  const baseVersion = versions?.find(v => v.id === baseVersionId) || null;

  // Default base version to the latest when versions change
  useEffect(() => {
    if (versions?.length && !baseInitialized) {
      setBaseVersionId(versions[0].id);
      setBaseInitialized(true);
      return;
    }
    if (baseVersionId && versions?.length && !versions.find(v => v.id === baseVersionId)) {
      setBaseVersionId(versions[0].id);
    }
  }, [versions, baseVersionId, baseInitialized]);

  // Load model profiles
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const res = await modelProfilesApi.list();
        setProfiles(res.data);
      } catch (error) {
        toast.error('Gagal memuat model profile');
      } finally {
        setProfilesLoading(false);
      }
    };
    loadProfiles();
  }, []);

  // Sync model profile selection with latest base version (or first profile as fallback)
  useEffect(() => {
    if (profilesLoading) return;

    setFormData((prev) => {
      if (baseVersion?.model_profile_id) {
        return { ...prev, model_profile_id: baseVersion.model_profile_id };
      }
      if (!prev.model_profile_id && profiles.length > 0) {
        return { ...prev, model_profile_id: profiles[0].id };
      }
      return prev;
    });
  }, [profilesLoading, baseVersion, profiles]);

  // Pre-fill from selected base version
  useEffect(() => {
    if (baseVersion) {
      setFormData({
        system_prompt: baseVersion.system_prompt || '',
        model_name: baseVersion.model_name || 'gpt-4o-mini',
        model_profile_id: baseVersion.model_profile_id || '',
        temperature: baseVersion.temperature || 0.7,
        max_tokens: baseVersion.max_tokens || 2048,
        top_p: baseVersion.top_p || 1.0,
        frequency_penalty: baseVersion.frequency_penalty || 0.0,
        presence_penalty: baseVersion.presence_penalty || 0.0,
        stop_sequences: baseVersion.stop_sequences?.join(', ') || '',
        notes: ''
      });
    }
  }, [baseVersion]);

  // Calculate changes when showing preview
  useEffect(() => {
    if (showPreview && baseVersion) {
      const changesFound = [];
      
      if (formData.system_prompt !== baseVersion.system_prompt) {
        changesFound.push({ field: 'System Prompt', old: baseVersion.system_prompt, new: formData.system_prompt });
      }
      if (formData.model_name !== baseVersion.model_name) {
        changesFound.push({ field: 'Model', old: baseVersion.model_name, new: formData.model_name });
      }
      if ((formData.model_profile_id || '') !== (baseVersion.model_profile_id || '')) {
        const fromName = profiles.find(p => p.id === baseVersion.model_profile_id)?.name || '(none)';
        const toName = profiles.find(p => p.id === formData.model_profile_id)?.name || '(none)';
        changesFound.push({ field: 'Model Profile', old: fromName, new: toName });
      }
      if (parseFloat(formData.temperature) !== parseFloat(baseVersion.temperature)) {
        changesFound.push({ field: 'Temperature', old: baseVersion.temperature, new: formData.temperature });
      }
      if (parseInt(formData.max_tokens) !== parseInt(baseVersion.max_tokens)) {
        changesFound.push({ field: 'Max Tokens', old: baseVersion.max_tokens, new: formData.max_tokens });
      }
      if (parseFloat(formData.top_p) !== parseFloat(baseVersion.top_p)) {
        changesFound.push({ field: 'Top P', old: baseVersion.top_p, new: formData.top_p });
      }
      if (parseFloat(formData.frequency_penalty) !== parseFloat(baseVersion.frequency_penalty)) {
        changesFound.push({ field: 'Frequency Penalty', old: baseVersion.frequency_penalty, new: formData.frequency_penalty });
      }
      if (parseFloat(formData.presence_penalty) !== parseFloat(baseVersion.presence_penalty)) {
        changesFound.push({ field: 'Presence Penalty', old: baseVersion.presence_penalty, new: formData.presence_penalty });
      }
      const stopOld = baseVersion.stop_sequences?.join(', ') || '';
      if (formData.stop_sequences !== stopOld) {
        changesFound.push({ field: 'Stop Sequences', old: stopOld || '(none)', new: formData.stop_sequences || '(none)' });
      }
      if ((formData.notes || '') !== (baseVersion.notes || '')) {
        changesFound.push({ field: 'Catatan', old: baseVersion.notes || '(none)', new: formData.notes || '(none)' });
      }
      
      setChanges(changesFound);
    }
  }, [showPreview, formData, baseVersion]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const payload = {
        ...formData,
        temperature: parseFloat(formData.temperature),
        max_tokens: parseInt(formData.max_tokens),
        top_p: parseFloat(formData.top_p),
        frequency_penalty: parseFloat(formData.frequency_penalty),
        presence_penalty: parseFloat(formData.presence_penalty),
        stop_sequences: formData.stop_sequences 
          ? formData.stop_sequences.split(',').map(s => s.trim()).filter(Boolean)
          : null
      };
      
      if (!formData.model_profile_id) {
        toast.error('Pilih Model Profile terlebih dahulu');
        setLoading(false);
        return;
      }

      await agentsApi.createVersion(agentId, payload);
      toast.success('Versi baru berhasil dibuat!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat versi');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Base version selection */}
      {versions?.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm text-blue-800 font-medium">Pilih versi dasar</p>
              <p className="text-sm text-blue-700 mt-1">
                Form otomatis terisi sesuai versi yang dipilih (termasuk model profile jika tersedia).
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Gunakan data dari versi</label>
              <select
                className="input"
                value={baseVersionId || 'blank'}
                onChange={(e) => {
                  const nextId = e.target.value === 'blank' ? null : e.target.value;
                  setBaseVersionId(nextId);
                  if (nextId === null) {
                    setFormData({
                      system_prompt: '',
                      model_name: 'gpt-4o-mini',
                      model_profile_id: profiles[0]?.id || '',
                      temperature: 0.7,
                      max_tokens: 2048,
                      top_p: 1.0,
                      frequency_penalty: 0.0,
                      presence_penalty: 0.0,
                      stop_sequences: '',
                      notes: ''
                    });
                  }
                }}
              >
                <option value="blank">Mulai dari kosong</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    Versi {version.version_number} • {version.model_name}
                  </option>
                ))}
              </select>
            </div>
            {baseVersion && (
              <div className="text-sm text-blue-800">
                <p className="font-medium">Ringkasan versi {baseVersion.version_number}</p>
                <p className="text-blue-700 line-clamp-2 mt-1">{baseVersion.system_prompt}</p>
              </div>
            )}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* System Prompt */}
        <div>
          <label className="label">System Prompt *</label>
          <textarea
            className="input min-h-[150px] font-mono text-sm"
            placeholder="Anda adalah asisten yang membantu..."
            value={formData.system_prompt}
            onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
            required
          />
          <p className="text-xs text-dark-400 mt-1">
            Instruksi dasar untuk AI agent. Definisikan peran, kemampuan, dan batasan.
          </p>
        </div>

        {/* Model Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Model Profile *</label>
            {profilesLoading ? (
              <div className="flex items-center gap-2 text-dark-500"><LoadingSpinner size="sm" /> Memuat...</div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-red-500">Buat Model Profile terlebih dahulu di menu Model Profile.</p>
            ) : (
              <select
                className="input"
                value={formData.model_profile_id}
                onChange={(e) => setFormData({ ...formData, model_profile_id: e.target.value })}
                required
              >
                {profiles.map((profile) => (
                  <option key={profile.id} value={profile.id}>{profile.name}</option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="label">Model Name *</label>
            <input
              type="text"
              className="input"
              placeholder="Nama model, misal gpt-4o"
              value={formData.model_name}
              onChange={(e) => setFormData({ ...formData, model_name: e.target.value })}
              required
            />
          </div>
        </div>

        {/* Advanced Settings Toggle */}
        <button
          type="button"
          className="flex items-center gap-2 text-sm font-medium text-primary-600 hover:text-primary-700"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          Pengaturan Lanjutan
        </button>

        {/* Advanced Settings */}
        {showAdvanced && (
          <div className="space-y-4 p-4 bg-dark-50 rounded-xl">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="label">Temperature</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Max Tokens</label>
                <input
                  type="number"
                  className="input"
                  min="1"
                  max="128000"
                  value={formData.max_tokens}
                  onChange={(e) => setFormData({ ...formData, max_tokens: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Top P</label>
                <input
                  type="number"
                  className="input"
                  min="0"
                  max="1"
                  step="0.05"
                  value={formData.top_p}
                  onChange={(e) => setFormData({ ...formData, top_p: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Freq. Penalty</label>
                <input
                  type="number"
                  className="input"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={formData.frequency_penalty}
                  onChange={(e) => setFormData({ ...formData, frequency_penalty: e.target.value })}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Presence Penalty</label>
                <input
                  type="number"
                  className="input"
                  min="-2"
                  max="2"
                  step="0.1"
                  value={formData.presence_penalty}
                  onChange={(e) => setFormData({ ...formData, presence_penalty: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Stop Sequences</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Pisahkan dengan koma"
                  value={formData.stop_sequences}
                  onChange={(e) => setFormData({ ...formData, stop_sequences: e.target.value })}
                />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="label">Catatan Versi (Opsional)</label>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="Perubahan: memperbaiki respons untuk..."
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
        </div>

        {/* Preview Changes (if has base version) */}
        {baseVersion && (
          <button
            type="button"
            className="w-full btn btn-secondary"
            onClick={() => setShowPreview(!showPreview)}
          >
            {showPreview ? 'Sembunyikan' : 'Lihat'} Perbandingan dengan Versi {baseVersion.version_number}
          </button>
        )}

        {showPreview && baseVersion && (
          <div className="border border-dark-200 rounded-xl overflow-hidden">
            <div className="bg-dark-50 px-4 py-3 border-b border-dark-200">
              <h4 className="font-medium text-dark-900">Perbandingan Perubahan</h4>
            </div>
            <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
              {changes.length === 0 ? (
                <p className="text-dark-500 text-center py-4">Tidak ada perubahan terdeteksi (kecuali kredensial)</p>
              ) : (
                changes.map((change, i) => (
                  <div key={i} className="border border-dark-100 rounded-lg p-3">
                    <p className="font-medium text-dark-700 text-sm mb-2">{change.field}</p>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-red-50 p-2 rounded max-h-48 overflow-auto">
                        <span className="text-red-600 font-medium">Sebelum:</span>
                        <p className="text-red-800 mt-1 break-words whitespace-pre-wrap">
                          {change.old || '(kosong)'}
                        </p>
                      </div>
                      <div className="bg-green-50 p-2 rounded max-h-48 overflow-auto">
                        <span className="text-green-600 font-medium">Sesudah:</span>
                        <p className="text-green-800 mt-1 break-words whitespace-pre-wrap">
                          {change.new || '(kosong)'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-dark-100">
          <button 
            type="button"
            onClick={onCancel}
            className="btn btn-secondary flex-1"
          >
            Batal
          </button>
          <button 
            type="submit"
            className="btn btn-primary flex-1"
            disabled={loading}
          >
            {loading ? <LoadingSpinner size="sm" /> : 'Buat Versi'}
          </button>
        </div>
        
        <p className="text-xs text-dark-400 text-center">
          ⚠️ Versi yang dibuat bersifat permanen dan tidak dapat diubah
        </p>
      </form>
    </div>
  );
};

export default CreateVersionForm;
