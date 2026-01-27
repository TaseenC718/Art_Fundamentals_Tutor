import React, { useState } from 'react';

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
  const [tasks, setTasks] = useState([
    { id: 1, text: "Draw 3 cubes in 1-Point Perspective", completed: false },
    { id: 2, text: "Draw a 'Transparent' Cube", completed: false },
    { id: 3, text: "Sketch a floating cube", completed: false },
  ]);

  const toggleTask = (id: number) => {
    setTasks(tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  return (
    <div className="h-full overflow-y-auto bg-paper pb-24 font-hand">
      <div className="bg-paper p-6 pb-8 border-b-2 border-pencil border-dashed relative">
        <h1 className="text-4xl font-heading text-pencil text-center mb-6 transform -rotate-1">My Profile</h1>
        <div className="bg-paper rounded-full w-40 h-40 mx-auto flex items-center justify-center mb-4 border-2 border-pencil shadow-sketch">
          <Mascot />
        </div>
        <p className="text-center text-sketch-orange font-bold text-xl uppercase tracking-widest">Level 3: Perspective Novice</p>
      </div>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-sm shadow-sketch border-2 border-pencil p-6 relative transform rotate-1">
          <div className="absolute -top-3 -right-3 bg-sketch-yellow border-2 border-pencil w-12 h-12 rounded-full grid place-items-center"><span className="text-2xl">⚡</span></div>
          <h2 className="text-2xl font-heading text-pencil mb-4 border-b-2 border-pencil pb-2 inline-block">Daily Goals</h2>
          <div className="space-y-3">
            {tasks.map(task => (
              <button
                key={task.id}
                onClick={() => toggleTask(task.id)}
                className={`w-full text-left p-3 rounded-sm border-2 transition-all duration-200 flex items-center gap-3 ${task.completed
                    ? 'bg-paper border-pencil/30 text-pencil/50'
                    : 'bg-white border-pencil text-pencil hover:bg-sketch-yellow/20 hover:shadow-sm'
                  }`}
              >
                <div className={`w-6 h-6 rounded-sm border-2 flex items-center justify-center ${task.completed ? 'bg-sketch-blue border-pencil' : 'border-pencil'
                  }`}>
                  {task.completed && <div className="text-pencil font-bold text-sm">✓</div>}
                </div>
                <span className={`text-lg ${task.completed ? 'line-through decoration-2 decoration-sketch-red' : ''}`}>{task.text}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-paper rounded-sm p-4 text-center border-2 border-pencil border-dashed">
          <p className="text-lg text-pencil font-bold uppercase tracking-widest mb-1">Total XP</p>
          <p className="text-5xl font-heading text-sketch-orange drop-shadow-[2px_2px_0px_#2D2D2D]">1,250</p>
        </div>
      </div>
    </div>
  );
};

export default Home;