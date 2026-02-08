import React, { useState, useEffect } from 'react';
import { Pencil } from 'lucide-react';
import { getProgress, getDailyTasks, completeTask, getLevelTitle, DailyTask, UserProgress } from '../services/storageService';
import Settings from './Settings';

const Mascot = () => (
  <svg viewBox="0 0 200 200" className="w-32 h-32 mx-auto filter drop-shadow-[4px_4px_0px_rgba(45,45,45,1)]">
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
);

const Home: React.FC = () => {
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [xpAnimation, setXpAnimation] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [completingTaskId, setCompletingTaskId] = useState<number | null>(null);

  useEffect(() => {
    setTasks(getDailyTasks());
    setProgress(getProgress());
  }, []);

  const handleCompleteTask = (id: number) => {
    // 1. Show checkmark animation
    setCompletingTaskId(id);

    // 2. Wait for animation, then replace task
    setTimeout(() => {
      const result = completeTask(id);
      setTasks(result.tasks);
      setProgress(getProgress());
      setCompletingTaskId(null);

      // Show XP animation
      if (result.xpGained !== 0) {
        setXpAnimation(result.xpGained);
        setTimeout(() => setXpAnimation(null), 1500);
      }
    }, 600);
  };

  const handleProfileUpdate = () => {
    setProgress(getProgress());
  };

  if (!progress) return null;

  const levelTitle = getLevelTitle(progress.level);

  return (
    <div className="h-full overflow-y-auto bg-paper pb-24 font-hand">
      <div className="bg-paper p-6 pb-8 border-b-2 border-pencil border-dashed relative">
        <h1 className="text-4xl font-heading text-pencil text-center mb-6 transform -rotate-1">My Profile</h1>
        <div className="relative w-40 h-40 mx-auto mb-4 group">
          <div className="bg-paper rounded-full w-full h-full flex items-center justify-center border-2 border-pencil shadow-sketch overflow-hidden">
            {progress.avatar && progress.avatar !== 'default' ? (
              <img src={progress.avatar} alt="Profile" className="w-full h-full object-cover" />
            ) : (
              <Mascot />
            )}
          </div>
          <button
            onClick={() => setShowSettings(true)}
            className="absolute bottom-0 right-0 bg-sketch-blue text-pencil p-2 rounded-full border-2 border-pencil shadow-sm hover:scale-110 transition-transform"
          >
            <Pencil size={16} />
          </button>
        </div>
        <h2 className="text-center text-2xl font-hand font-bold text-pencil mb-1">{progress.displayName || 'Artist'}</h2>
        <p className="text-center text-sketch-orange font-bold text-xl uppercase tracking-widest">
          Level {progress.level}: {levelTitle}
        </p>
        {progress.streak > 0 && (
          <p className="text-center text-sketch-red font-bold mt-2">
            {progress.streak} Day Streak!
          </p>
        )}
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-sm shadow-sketch border-2 border-pencil p-6 relative transform rotate-1">
          <div className="absolute -top-3 -right-3 bg-sketch-yellow border-2 border-pencil w-12 h-12 rounded-full grid place-items-center"><span className="text-2xl">⚡</span></div>
          <h2 className="text-2xl font-heading text-pencil mb-4 border-b-2 border-pencil pb-2 inline-block">Daily Goals</h2>
          <div className="space-y-3">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => handleCompleteTask(task.id)}
                disabled={completingTaskId === task.id || task.completed}
                className={`w-full text-left p-3 rounded-sm border-2 transition-all duration-300 flex items-center gap-3 ${completingTaskId === task.id ? 'scale-95 opacity-50 bg-green-50 border-green-500' :
                    task.completed
                      ? 'bg-paper border-pencil/30 text-pencil/50'
                      : 'bg-white border-pencil text-pencil hover:bg-sketch-yellow/20 hover:shadow-sm'
                  }`}
              >
                <div className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center ${task.completed ? 'bg-sketch-blue border-pencil' : 'border-pencil'
                  }`}>
                  {completingTaskId === task.id && <div className="text-pencil font-bold text-sm animate-bounce">✓</div>}
                </div>
                <span className={`text-lg ${task.completed ? 'line-through decoration-2 decoration-sketch-red' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-paper rounded-sm p-4 text-center border-2 border-pencil border-dashed relative">
          <p className="text-lg text-pencil font-bold uppercase tracking-widest mb-1">Total XP</p>
          <p className="text-5xl font-heading text-sketch-orange drop-shadow-[2px_2px_0px_#2D2D2D]">
            {progress.xp.toLocaleString()}
          </p>
          {xpAnimation !== null && (
            <span
              className={`absolute top-2 right-4 text-2xl font-bold animate-bounce ${xpAnimation > 0 ? 'text-green-500' : 'text-red-500'}`}
            >
              {xpAnimation > 0 ? '+' : ''}{xpAnimation} XP
            </span>
          )}
        </div>
      </div>
      <Settings
        isOpen={showSettings}
        onClose={() => {
          setShowSettings(false);
          handleProfileUpdate();
        }}
      />
    </div>
  );
};

export default Home;
