import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('token'));

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        try {
          const response = await authApi.getMe();
          setUser(response.data);
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('project');
          setToken(null);
        }
      }
      setLoading(false);
    };
    
    initAuth();
  }, []);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    const { access_token, project } = response.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('project', JSON.stringify(project));
    setToken(access_token);
    setUser(project);
    return response.data;
  };

  const register = async (data) => {
    const response = await authApi.register(data);
    const { access_token, project } = response.data;
    localStorage.setItem('token', access_token);
    localStorage.setItem('project', JSON.stringify(project));
    setToken(access_token);
    setUser(project);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('project');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getMe();
      setUser(response.data);
      localStorage.setItem('project', JSON.stringify(response.data));
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      register, 
      logout, 
      refreshUser,
      isAuthenticated: !!token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
