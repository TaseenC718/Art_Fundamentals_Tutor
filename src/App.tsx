import React, { useState } from 'react';
import CritiqueZone from './components/CritiqueZone';
import Home from './components/Home';
import Progress from './components/Progress';
import Settings from './components/Settings';
import { AppMode } from './types';
import { Icons } from './components/Icon';
import { Settings as SettingsIcon } from 'lucide-react';
import { getDifficulty, Difficulty } from './services/storageService';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>('practice');
  const [showSettings, setShowSettings] = useState(false);
  const [difficulty, setDifficultyState] = useState<Difficulty>(getDifficulty);

  const NavItem = ({ mode, icon, label }: { mode: AppMode; icon: React.ReactNode; label: string }) => (
    <button
      onClick={() => setActiveMode(mode)}
      className={`flex flex-col items-center justify-center w-full py-2 transition-all duration-200 group ${activeMode === mode
          ? 'text-sketch-orange transform -translate-y-1'
          : 'text-pencil hover:text-sketch-blue'
        }`}
    >
      <div className={`mb-1 transition-transform duration-200 border-2 rounded-full p-1.5 ${activeMode === mode ? 'scale-110 bg-pencil text-paper border-pencil shadow-sketch' : 'border-transparent group-hover:bg-sketch-yellow/20'}`}>
        {icon}
      </div>
      <span className="text-xs font-bold tracking-wide uppercase font-hand">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col h-screen bg-paper overflow-hidden relative font-hand text-pencil">

      {/* Settings Button */}
      <button
        onClick={() => setShowSettings(true)}
        className="absolute top-4 right-4 z-40 w-10 h-10 bg-white border-2 border-pencil rounded-full flex items-center justify-center shadow-sketch hover:bg-sketch-yellow transition-colors"
        aria-label="Settings"
      >
        <SettingsIcon size={20} />
      </button>

      {/* Settings Modal */}
      <Settings
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        onDifficultyChange={setDifficultyState}
      />

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden">
        {activeMode === 'profile' && <Home />}
        {activeMode === 'practice' && <CritiqueZone difficulty={difficulty} />}
        {activeMode === 'progress' && <Progress />}
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 bg-white border-t-2 border-pencil border-dashed flex items-center justify-around px-6 pb-safe z-50">
        <NavItem mode="profile" icon={<Icons.User />} label="Profile" />
        <NavItem mode="practice" icon={<Icons.Cube />} label="Practice" />
        <NavItem mode="progress" icon={<Icons.Chart />} label="Progress" />
      </nav>

    </div>
  );
};

export default App;