import React, { useState } from 'react';
import CritiqueZone from './components/CritiqueZone';
import Home from './components/Home';
import Progress from './components/Progress';
import { AppMode } from './types';
import { Icons } from './components/Icon';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>('practice');

  const NavItem = ({ mode, icon, label }: { mode: AppMode; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActiveMode(mode)}
      className={`flex flex-col items-center justify-center w-full py-2 transition-all duration-200 ${
        activeMode === mode
          ? 'text-indigo-600'
          : 'text-slate-400 hover:text-slate-600'
      }`}
    >
      <div className={`mb-1 transition-transform duration-200 ${activeMode === mode ? 'scale-110' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden relative font-sans">
      
      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activeMode === 'profile' && <Home />}
        {activeMode === 'practice' && <CritiqueZone />}
        {activeMode === 'progress' && <Progress />}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-white border-t border-slate-200 flex items-center justify-around px-6 pb-safe z-50 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <NavItem mode="profile" icon={<Icons.User />} label="Profile" />
        <NavItem mode="practice" icon={<Icons.Cube />} label="Practice" />
        <NavItem mode="progress" icon={<Icons.Chart />} label="Progress" />
      </nav>
      
    </div>
  );
};

export default App;