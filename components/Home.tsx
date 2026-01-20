import React, { useState } from 'react';

const Mascot = () => (
  <svg viewBox="0 0 200 200" className="w-32 h-32 mx-auto drop-shadow-md filter">
    <circle cx="100" cy="100" r="80" fill="#4F46E5" />
    <circle cx="100" cy="90" r="60" fill="#6366F1" />
    <ellipse cx="75" cy="85" rx="12" ry="15" fill="white" />
    <ellipse cx="125" cy="85" rx="12" ry="15" fill="white" />
    <circle cx="75" cy="85" r="5" fill="#1E1B4B" />
    <circle cx="125" cy="85" r="5" fill="#1E1B4B" />
    <circle cx="60" cy="110" r="8" fill="#F472B6" opacity="0.6" />
    <circle cx="140" cy="110" r="8" fill="#F472B6" opacity="0.6" />
    <path d="M 80 120 Q 100 135 120 120" stroke="white" strokeWidth="4" fill="none" strokeLinecap="round" />
    <path d="M 50 60 Q 100 20 160 70" fill="#DC2626" /> 
    <rect x="95" y="35" width="10" height="10" fill="#DC2626" />
  </svg>
);

const Home: React.FC = () => {
  const [tasks, setTasks] = useState([
    { id: 1, text: "Draw 3 cubes in 1-Point Perspective", completed: false },
    { id: 2, text: "Draw a 'Transparent' Cube", completed: false },
    { id: 3, text: "Sketch a floating cube", completed: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50 pb-24">
      <div className="bg-white p-6 pb-8 border-b border-slate-100">
        <h1 className="text-2xl font-serif text-slate-800 text-center mb-6">My Profile</h1>
        <div className="bg-indigo-50 rounded-full w-40 h-40 mx-auto flex items-center justify-center mb-4">
             <Mascot />
        </div>
        <p className="text-center text-slate-500 font-medium">Level 3: Perspective Novice</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
            <h2 className="text-lg font-bold text-slate-800 mb-4">Daily Goals</h2>
            <div className="space-y-3">
                {tasks.map(task => (
                    <button 
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        className={`w-full text-left p-3 rounded-xl border transition-all duration-200 flex items-center gap-3 ${
                            task.completed 
                                ? 'bg-slate-50 border-slate-100 text-slate-400' 
                                : 'bg-white border-slate-200 text-slate-700'
                        }`}
                    >
                        <div className={`w-5 h-5 rounded border flex items-center justify-center ${
                            task.completed ? 'bg-indigo-500 border-indigo-500' : 'border-slate-300'
                        }`}>
                            {task.completed && <div className="text-white text-xs">✓</div>}
                        </div>
                        <span className={`text-sm ${task.completed ? 'line-through' : ''}`}>{task.text}</span>
                    </button>
                ))}
            </div>
        </div>

        <div className="bg-slate-100 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Total XP</p>
            <p className="text-3xl font-bold text-slate-800">1,250</p>
        </div>
      </div>
    </div>
  );
};

export default Home;