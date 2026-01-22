import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Bot, Eye, EyeOff, ArrowRight, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

const LoginPage = () => {
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await login(formData);
      toast.success('Login berhasil! Selamat datang kembali.');
      navigate('/dashboard');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Username atau password salah');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-white">Prompt Manager</span>
          </div>
        </div>
        
        <div className="space-y-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-4">
              AI Prompts <br />Management
            </h1>
            <p className="text-primary-100 text-lg leading-relaxed">
              Platform Manajemen Prompt AI dengan versioning, 
              Agents API integration.
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: '🤖', label: 'Agent Creation' },
              { icon: '📝', label: 'Versioning' },
              { icon: '🔐', label: 'Secure API' },
              { icon: '💬', label: 'Live Chat' }
            ].map((item, i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">{item.icon}</span>
                <span className="text-white font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-primary-200">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Powered by Owlexa Healthcare</span>
        </div>
      </div>
      
      {/* Right Side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-dark-50">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <span className="text-2xl font-bold text-dark-900">Prompt Manager</span>
          </div>
          
          <div className="card p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-dark-900">Masuk ke Project</h2>
              <p className="text-dark-500 mt-2">Masukkan kredensial project Anda</p>
            </div>
            
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Username Project</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Masukkan username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  required
                />
              </div>
              
              <div>
                <label className="label">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-12"
                    placeholder="Masukkan password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
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
              
              <button 
                type="submit" 
                className="btn btn-primary w-full"
                disabled={loading}
              >
                {loading ? (
                  <span className="spinner w-5 h-5" />
                ) : (
                  <>
                    Masuk
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </form>
            
            <div className="mt-6 text-center">
              <p className="text-dark-500">
                Belum punya project?{' '}
                <Link to="/register" className="text-primary-600 font-medium hover:text-primary-700">
                  Buat Project Baru
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
