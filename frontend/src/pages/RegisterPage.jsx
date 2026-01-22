import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, Eye, EyeOff, ArrowRight, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

const RegisterPage = () => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }
    
    if (formData.password.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    
    setLoading(true);
    
    try {
      await register({
        name: formData.name,
        description: formData.description,
        username: formData.username,
        password: formData.password
      });
      toast.success('Project berhasil dibuat! Selamat datang.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Gagal membuat project');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-gradient-to-br from-dark-50 to-primary-50">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg shadow-primary-600/30">
            <Bot className="w-7 h-7 text-white" />
          </div>
          <span className="text-2xl font-bold text-dark-900">Prompt Manager</span>
        </div>
        
        <div className="card p-8">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-dark-900">Buat Project Baru</h2>
            <p className="text-dark-500 mt-2">Isi detail project dan kredensial untuk tim Anda</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label">Nama Project</label>
              <input
                type="text"
                className="input"
                placeholder="Contoh: Customer Support AI"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            
            <div>
              <label className="label">Deskripsi (Opsional)</label>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Jelaskan tujuan project ini..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            
            <div className="border-t border-dark-100 pt-5">
              <p className="text-sm text-dark-600 mb-4 font-medium">
                🔐 Kredensial Login Tim
              </p>
              
              <div className="space-y-4">
                <div>
                  <label className="label">Username</label>
                  <input
                    type="text"
                    className="input"
                    placeholder="Username untuk login tim"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    required
                    minLength={3}
                  />
                </div>
                
                <div>
                  <label className="label">Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      className="input pr-12"
                      placeholder="Minimal 6 karakter"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      required
                      minLength={6}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-600"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                
                <div>
                  <label className="label">Konfirmasi Password</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input"
                    placeholder="Ulangi password"
                    value={formData.confirmPassword}
                    onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? (
                <span className="spinner w-5 h-5" />
              ) : (
                <>
                  Buat Project
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>
          
          <div className="mt-6 text-center">
            <Link to="/login" className="inline-flex items-center gap-2 text-dark-500 hover:text-dark-700">
              <ArrowLeft className="w-4 h-4" />
              Kembali ke Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
