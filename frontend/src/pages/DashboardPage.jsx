import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Bot, Key, MessageSquare, Settings, LogOut, Menu, X, 
  ChevronRight, Layers, Home, BookOpen, Clock, ChevronsLeft, ChevronsRight
} from 'lucide-react';
import AgentsTab from '../components/tabs/AgentsTab';
import ApiKeysTab from '../components/tabs/ApiKeysTab';
import ChatTab from '../components/tabs/ChatTab';
import SettingsTab from '../components/tabs/SettingsTab';
import ModelProfilesTab from '../components/tabs/ModelProfilesTab';
import ApiGuideTab from '../components/tabs/ApiGuideTab';
import ChatHistoryTab from '../components/tabs/ChatHistoryTab';

const DashboardPage = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('model-profiles');

  useEffect(() => {
    refreshUser();
  }, []);

  useEffect(() => {
    const path = location.pathname.split('/').pop();
    if (['agents', 'api-keys', 'api-guide', 'chat', 'chat-history', 'settings', 'model-profiles'].includes(path)) {
      setActiveTab(path);
    } else {
      setActiveTab('model-profiles');
    }
  }, [location]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    navigate(`/dashboard/${tab}`);
    setSidebarOpen(false);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const menuItems = [
    { id: 'model-profiles', label: 'Model Profile', icon: Bot },
    { id: 'api-keys', label: 'API Keys', icon: Key },
    { id: 'agents', label: 'Agents', icon: Layers },
    { id: 'api-guide', label: 'API Guide', icon: BookOpen },
    { id: 'chat', label: 'Chat Playground', icon: MessageSquare },
    { id: 'chat-history', label: 'Chat History', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-dark-50 flex">
      {/* Sidebar Overlay (Mobile) */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-dark-900/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed lg:sticky inset-y-0 left-0 z-50 lg:top-0
        ${sidebarCollapsed ? 'w-20' : 'w-72'} bg-white border-r border-dark-100 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col h-screen lg:h-screen max-h-screen overflow-hidden
      `}>
        {/* Sidebar Header */}
        <div className="px-5 py-5 border-b border-dark-100 flex items-center justify-between min-h-[80px]">
          {!sidebarCollapsed ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-dark-900">Prompt Manager</h1>
                <p className="text-xs text-dark-500">v1.0.0</p>
              </div>
            </div>
          ) : (
            <div></div> // Spacer for collapsed state
          )}

          <div className="flex items-center gap-2">
            <button
              className="hidden lg:inline-flex p-2 hover:bg-dark-100 rounded-lg"
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Sempitkan sidebar'}
            >
              {sidebarCollapsed ? (
                <ChevronsRight className="w-5 h-5" />
              ) : (
                <ChevronsLeft className="w-5 h-5" />
              )}
            </button>
            <button 
              className="lg:hidden p-2 hover:bg-dark-100 rounded-lg"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Project Info */}
        <div className={`mx-4 mt-4 rounded-lg bg-gradient-to-r from-blue-50 to-blue-100 ${sidebarCollapsed ? 'p-3' : 'p-4'} shadow-sm border border-blue-200`}>
          <div className={`flex ${sidebarCollapsed ? 'justify-center' : 'items-center gap-3'}`}>
            <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'P'}
            </div>
            {!sidebarCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-dark-900 text-sm">{user?.name}</p>
                    <p className="text-xs text-dark-500">@{user?.username}</p>
                  </div>
                  <div className="text-right text-xs text-dark-600">
                    <div className="flex flex-col gap-1">
                      <span><strong className="text-primary-600 font-medium">{user?.agents_count || 0}</strong> Agents</span>
                      <span><strong className="text-primary-600 font-medium">{user?.api_keys_count || 0}</strong> API Keys</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className={`flex-1 ${sidebarCollapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto`}> 
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`
                w-full flex items-center gap-3 ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'} rounded-xl transition-all duration-200
                ${activeTab === item.id 
                  ? 'bg-primary-600 text-white shadow-lg shadow-primary-600/30' 
                  : 'text-dark-600 hover:bg-dark-100'
                }
              `}
            >
              <item.icon className="w-5 h-5" />
              {!sidebarCollapsed && (
                <>
                  <span className="font-medium text-sm">{item.label}</span>
                  <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${activeTab === item.id ? 'rotate-90' : ''}`} />
                </>
              )}
            </button>
          ))}
        </nav>

        {/* Logout */}
        <div className={`p-4 border-t border-dark-100 ${sidebarCollapsed ? 'mt-auto' : ''}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 ${sidebarCollapsed ? 'px-3 py-3 justify-center' : 'px-4 py-3'} rounded-xl text-red-600 hover:bg-red-50 transition-all`}
          >
            <LogOut className="w-5 h-5" />
            {!sidebarCollapsed && <span className="font-medium text-sm">Keluar</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* Top Bar */}
        <header className="bg-white border-b border-dark-100 px-6 lg:px-8 py-5 flex items-center justify-between lg:justify-end gap-3 sticky top-0 z-40 min-h-[80px]">
          <button 
            className="lg:hidden p-2 hover:bg-dark-100 rounded-lg"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>

          <button
            className="hidden lg:inline-flex p-2 hover:bg-dark-100 rounded-lg"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Perluas sidebar' : 'Sempitkan sidebar'}
          >
            {sidebarCollapsed ? (
              <ChevronsRight className="w-5 h-5" />
            ) : (
              <ChevronsLeft className="w-5 h-5" />
            )}
          </button>
          
          <div className="flex items-center gap-2 text-sm text-dark-500">
            <Home className="w-4 h-4" />
            <span>/</span>
            <span className="capitalize text-dark-900 font-medium">
              {activeTab.replace('-', ' ')}
            </span>
          </div>
        </header>

        {/* Content Area */}
        <div className="flex-1 p-6 overflow-auto min-w-0">
          {activeTab === 'agents' && <AgentsTab />}
          {activeTab === 'model-profiles' && <ModelProfilesTab />}
          {activeTab === 'api-keys' && <ApiKeysTab />}
          {activeTab === 'api-guide' && <ApiGuideTab />}
          {activeTab === 'chat' && <ChatTab />}
          {activeTab === 'chat-history' && <ChatHistoryTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
