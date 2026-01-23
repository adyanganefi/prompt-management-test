import { useState } from 'react';
import { format, addHours } from 'date-fns';
import { id as localeId } from 'date-fns/locale';
import { useAuth } from '../../context/AuthContext';
import { authApi } from '../../api';
import { useNavigate } from 'react-router-dom';
import { Settings, Save, AlertTriangle, Trash2, User, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';

const SettingsTab = () => {
  const { user, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: user?.name || '',
    description: user?.description || ''
  });
  const [saving, setSaving] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await authApi.updateProject(formData);
      await refreshUser();
      toast.success('Pengaturan berhasil disimpan');
    } catch (error) {
      toast.error('Gagal menyimpan pengaturan');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirm !== user?.username) {
      toast.error('Username tidak cocok');
      return;
    }
    
    setDeleting(true);
    try {
      await authApi.deleteProject();
      toast.success('Project berhasil dihapus');
      logout();
      navigate('/login');
    } catch (error) {
      toast.error('Gagal menghapus project');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-dark-900">Settings</h2>
        <p className="text-dark-500 mt-1">Kelola pengaturan project Anda</p>
      </div>

      {/* Project Info */}
      <div className="card">
        <div className="p-6 border-b border-dark-100">
          <div className="flex items-center gap-3">
            <Settings className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-dark-900">Informasi Project</h3>
          </div>
        </div>
        <form onSubmit={handleSave} className="p-6 space-y-4">
          <div>
            <label className="label">Nama Project</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="label">Deskripsi</label>
            <textarea
              className="input min-h-[100px] resize-none"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Deskripsi project..."
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <LoadingSpinner size="sm" /> : <Save className="w-4 h-4" />}
            Simpan Perubahan
          </button>
        </form>
      </div>

      {/* Account Info */}
      <div className="card">
        <div className="p-6 border-b border-dark-100">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-dark-900">Informasi Akun</h3>
          </div>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="label">Username</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                className="input bg-dark-50"
                value={user?.username || ''}
                disabled
              />
              <Lock className="w-5 h-5 text-dark-400" />
            </div>
            <p className="text-xs text-dark-400 mt-1">Username tidak dapat diubah</p>
          </div>
          <div>
            <label className="label">Dibuat pada</label>
            <input
              type="text"
              className="input bg-dark-50"
              value={user?.created_at ? format(addHours(new Date(user.created_at), 7), 'dd MMM yyyy HH:mm:ss', { locale: localeId }) : '-'}
              disabled
            />
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="card border-red-200">
        <div className="p-6 border-b border-red-100 bg-red-50">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h3 className="text-lg font-semibold text-red-900">Zona Berbahaya</h3>
          </div>
        </div>
        <div className="p-6">
          {!showDelete ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-dark-900">Hapus Project</p>
                <p className="text-sm text-dark-500">
                  Menghapus project akan menghapus semua data termasuk agents, versi, dan chat history
                </p>
              </div>
              <button
                onClick={() => setShowDelete(true)}
                className="btn btn-danger"
              >
                <Trash2 className="w-4 h-4" />
                Hapus Project
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-xl">
                <p className="text-sm text-red-800 font-medium mb-2">
                  ⚠️ Peringatan: Tindakan ini tidak dapat dibatalkan!
                </p>
                <p className="text-sm text-red-700">
                  Untuk mengkonfirmasi, ketik username project Anda: <strong>{user?.username}</strong>
                </p>
              </div>
              <input
                type="text"
                className="input input-error"
                placeholder={`Ketik "${user?.username}" untuk mengkonfirmasi`}
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
              />
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDelete(false);
                    setDeleteConfirm('');
                  }}
                  className="btn btn-secondary flex-1"
                >
                  Batal
                </button>
                <button
                  onClick={handleDelete}
                  className="btn btn-danger flex-1"
                  disabled={deleteConfirm !== user?.username || deleting}
                >
                  {deleting ? <LoadingSpinner size="sm" /> : 'Hapus Permanen'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsTab;
