import React, { useState } from 'react';
import CritiqueZone from './components/CritiqueZone';
import Home from './components/Home';
import Progress from './components/Progress';
import Settings from './components/Settings';
import Camera from './components/Camera';
import Learn from './components/Learn';
import { AppMode } from './types';
import { Icons } from './components/Icon';
import { Settings as SettingsIcon } from 'lucide-react';
import { getDifficulty, Difficulty } from './services/storageService';

const App: React.FC = () => {
  const [activeMode, setActiveMode] = useState<AppMode>('practice');
  const [showSettings, setShowSettings] = useState(false);
  const [difficulty, setDifficultyState] = useState<Difficulty>(getDifficulty);

  const NavItem = ({ mode, icon, label, isCenter }: { mode: AppMode; icon: React.ReactNode; label: string; isCenter?: boolean }) => (
    <button
      onClick={() => setActiveMode(mode)}
      className={`flex flex-col items-center justify-center w-full py-2 transition-all duration-200 group ${activeMode === mode
          ? 'text-sketch-orange transform -translate-y-1'
          : 'text-pencil hover:text-sketch-blue'
        }`}
    >
      <div className={`mb-1 transition-transform duration-200 border-2 rounded-full ${isCenter ? 'p-2.5' : 'p-1.5'} ${
        activeMode === mode
          ? isCenter
            ? 'scale-110 bg-sketch-orange text-pencil border-pencil shadow-sketch'
            : 'scale-110 bg-pencil text-paper border-pencil shadow-sketch'
          : isCenter
            ? 'bg-sketch-blue/20 border-pencil group-hover:bg-sketch-blue/40'
            : 'border-transparent group-hover:bg-sketch-yellow/20'
      }`}>
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
        {activeMode === 'learn' && <Learn />}
        {activeMode === 'camera' && <Camera />}
        {activeMode === 'practice' && <CritiqueZone difficulty={difficulty} />}
        {activeMode === 'progress' && <Progress />}
      </main>

      {/* Bottom Navigation - 5 tabs */}
      <nav className="h-20 bg-white border-t-2 border-pencil border-dashed flex items-center justify-around px-2 pb-safe z-50">
        <NavItem mode="profile" icon={<Icons.User />} label="Profile" />
        <NavItem mode="learn" icon={<Icons.BookOpen />} label="Learn" />
        <NavItem mode="camera" icon={<Icons.Camera />} label="Camera" isCenter />
        <NavItem mode="practice" icon={<Icons.Cube />} label="Practice" />
        <NavItem mode="progress" icon={<Icons.Chart />} label="Progress" />
      </nav>

    </div>
  );
};

export default App;