import { useState } from 'react';
import { agentsApi } from '../../api';
import toast from 'react-hot-toast';
import LoadingSpinner from '../LoadingSpinner';

const CreateAgentForm = ({ onSuccess, onCancel }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await agentsApi.create(formData);
      toast.success('Agent berhasil dibuat!');
      onSuccess();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat agent');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nama Agent</label>
        <input
          type="text"
          className="input"
          placeholder="Contoh: Customer Support Bot"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />
      </div>
      
      <div>
        <label className="label">Deskripsi (Opsional)</label>
        <textarea
          className="input min-h-[100px] resize-none"
          placeholder="Jelaskan fungsi agent ini..."
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
        />
      </div>
      
      <div className="flex gap-3 pt-4">
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
          {loading ? <LoadingSpinner size="sm" /> : 'Buat Agent'}
        </button>
      </div>
      
      <p className="text-xs text-dark-400 text-center">
        Setelah agent dibuat, Anda dapat menambahkan versi dengan konfigurasi prompt
      </p>
    </form>
  );
};

export default CreateAgentForm;
