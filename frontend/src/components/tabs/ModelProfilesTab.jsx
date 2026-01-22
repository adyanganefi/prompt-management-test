import { useEffect, useState } from 'react';
import { modelProfilesApi } from '../../api';
import { Plus, Edit3, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import Modal from '../Modal';
import LoadingSpinner from '../LoadingSpinner';

const emptyForm = { name: '', api_key: '', base_url: '' };

const ModelProfilesTab = () => {
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);

  const fetchProfiles = async () => {
    try {
      const res = await modelProfilesApi.list();
      setProfiles(res.data);
    } catch (err) {
      toast.error('Gagal memuat model profile');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setFormData(emptyForm);
    setShowModal(true);
  };

  const openEdit = (profile) => {
    setEditingId(profile.id);
    setFormData({ name: profile.name, api_key: '', base_url: profile.base_url || '' });
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (editingId) {
        await modelProfilesApi.update(editingId, {
          name: formData.name,
          base_url: formData.base_url || null,
          api_key: formData.api_key || undefined,
        });
        toast.success('Profil berhasil diperbarui');
      } else {
        await modelProfilesApi.create({
          name: formData.name,
          base_url: formData.base_url || null,
          api_key: formData.api_key,
        });
        toast.success('Profil berhasil dibuat');
      }
      setShowModal(false);
      setFormData(emptyForm);
      setEditingId(null);
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Hapus profil ini?')) return;
    try {
      await modelProfilesApi.delete(id);
      toast.success('Profil dihapus');
      fetchProfiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Gagal menghapus profil');
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-dark-900">Model Profile</h2>
          <p className="text-dark-500 mt-1">Kelola kredensial model untuk digunakan ulang di versi agent</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>
          <Plus className="w-5 h-5" />
          Tambah Profil
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="card p-10 text-center">
          <p className="text-dark-600">Belum ada profil. Tambahkan untuk mempermudah pembuatan versi.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {profiles.map((profile) => (
            <div key={profile.id} className="card p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-dark-500">Nama Profil</p>
                  <p className="text-lg font-semibold text-dark-900">{profile.name}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button className="btn btn-sm btn-secondary" onClick={() => openEdit(profile)}>
                    <Edit3 className="w-4 h-4" />
                    Edit
                  </button>
                  <button className="btn btn-sm btn-ghost text-red-600 hover:bg-red-50" onClick={() => handleDelete(profile.id)}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm text-dark-500">Base URL</p>
                <p className="text-sm text-dark-800 break-all">{profile.base_url || '(default)'}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-dark-100 px-3 py-1 rounded-lg text-sm font-mono truncate max-w-full">
                  {profile.api_key_masked}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editingId ? 'Ubah Model Profile' : 'Tambah Model Profile'}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="label">Nama Profil</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="label">Base URL (opsional)</label>
            <input
              type="url"
              className="input"
              placeholder="https://api.openai.com/v1"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
            />
          </div>

          <div>
            <label className="label">API Key {editingId ? '(kosongkan jika tidak diubah)' : '*'}</label>
            <input
              type="password"
              className="input"
              placeholder="sk-..."
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
              required={!editingId}
            />
            <p className="text-xs text-dark-400 mt-1">Disimpan terenkripsi dan selalu ditampilkan sebagai mask.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" className="btn btn-secondary flex-1" onClick={() => setShowModal(false)}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary flex-1" disabled={saving}>
              {saving ? <LoadingSpinner size="sm" /> : 'Simpan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ModelProfilesTab;
