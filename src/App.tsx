import React, { useState, useEffect } from 'react';
import Home from './components/Home';
import CritiqueZone from './components/CritiqueZone';
import Progress from './components/Progress';
import Settings from './components/Settings';
import Camera from './components/Camera';
import Learn from './components/Learn';
import { AppMode } from './types';
import { Icons } from './components/Icon';
import { Settings as SettingsIcon } from 'lucide-react';
import { getDifficulty, Difficulty, isOnboardingCompleted } from './services/storageService';
import Onboarding from './components/Onboarding';

const SplashScreen = ({ onDone }: { onDone: () => void }) => {
  const [visible, setVisible] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    const fadeIn = setTimeout(() => setVisible(true), 100);
    const fadeOut = setTimeout(() => setFadingOut(true), 1800);
    const done = setTimeout(onDone, 2400);
    return () => { clearTimeout(fadeIn); clearTimeout(fadeOut); clearTimeout(done); };
  }, [onDone]);

  return (
    <div className={`fixed inset-0 bg-paper z-[100] flex flex-col items-center justify-center transition-opacity duration-500 ${fadingOut ? 'opacity-0' : 'opacity-100'}`}>
      <div className={`transition-all duration-700 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}`}>
        <svg viewBox="0 0 200 200" className="w-40 h-40 mx-auto filter drop-shadow-[4px_4px_0px_rgba(45,45,45,1)]">
          <circle cx="100" cy="100" r="80" fill="#AEC6CF" stroke="#2D2D2D" strokeWidth="3" />
          <circle cx="100" cy="90" r="60" fill="#FFFFFF" stroke="#2D2D2D" strokeWidth="3" />
          <ellipse cx="75" cy="85" rx="12" ry="15" fill="#2D2D2D" />
          <ellipse cx="125" cy="85" rx="12" ry="15" fill="#2D2D2D" />
          <circle cx="60" cy="110" r="8" fill="#FFB347" opacity="0.6" />
          <circle cx="140" cy="110" r="8" fill="#FFB347" opacity="0.6" />
          <path d="M 80 120 Q 100 135 120 120" stroke="#2D2D2D" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 50 60 Q 100 20 160 70" fill="#FF6961" stroke="#2D2D2D" strokeWidth="3" />
          <rect x="95" y="35" width="10" height="10" fill="#FF6961" stroke="#2D2D2D" strokeWidth="2" />
        </svg>
        <h1 className="text-3xl font-heading text-pencil text-center mt-6 transform -rotate-1">Art Fundamentals Tutor</h1>
      </div>
      <div className="flex items-center gap-2 mt-8">
        <span className="w-2 h-2 bg-pencil rounded-full animate-bounce" />
        <span className="w-2 h-2 bg-pencil rounded-full animate-bounce [animation-delay:75ms]" />
        <span className="w-2 h-2 bg-pencil rounded-full animate-bounce [animation-delay:150ms]" />
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [showSplash, setShowSplash] = useState(true);
  const [onboardingDone, setOnboardingDone] = useState(isOnboardingCompleted);
  const [activeMode, setActiveMode] = useState<AppMode>('profile');
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
      <div className={`mb-1 transition-transform duration-200 border-2 rounded-full ${isCenter ? 'p-2.5' : 'p-1.5'} ${activeMode === mode
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

  if (showSplash) {
    return <SplashScreen onDone={() => setShowSplash(false)} />;
  }

  if (!onboardingDone) {
    return (
      <Onboarding
        onComplete={(selectedDifficulty) => {
          setDifficultyState(selectedDifficulty);
          setOnboardingDone(true);
        }}
      />
    );
  }

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