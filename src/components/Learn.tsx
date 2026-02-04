import React, { useState } from 'react';
import LessonHub from './LessonHub';
import ChatInterface from './ChatInterface';
import { Icons } from './Icon';

type LearnMode = 'lessons' | 'chat';

const Learn: React.FC = () => {
  const [mode, setMode] = useState<LearnMode>('lessons');

  return (
    <div className="h-full flex flex-col bg-paper">
      {/* Toggle Header */}
      <div className="p-4 border-b-2 border-pencil border-dashed bg-white/50">
        <div className="max-w-md mx-auto">
          <div className="flex bg-paper rounded-lg p-1 border-2 border-pencil">
            <button
              onClick={() => setMode('lessons')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-bold font-hand text-sm transition-all ${
                mode === 'lessons'
                  ? 'bg-sketch-orange text-pencil border-2 border-pencil shadow-sm transform -rotate-1'
                  : 'text-pencil/70 hover:text-pencil hover:bg-sketch-yellow/30 border-2 border-transparent'
              }`}
            >
              <Icons.BookOpen />
              Lessons
            </button>
            <button
              onClick={() => setMode('chat')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-md font-bold font-hand text-sm transition-all ${
                mode === 'chat'
                  ? 'bg-sketch-orange text-pencil border-2 border-pencil shadow-sm transform rotate-1'
                  : 'text-pencil/70 hover:text-pencil hover:bg-sketch-yellow/30 border-2 border-transparent'
              }`}
            >
              <Icons.MessageSquare />
              AI Tutor
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden">
        {mode === 'lessons' ? (
          <LessonHub />
        ) : (
          <ChatInterface />
        )}
      </div>
    </div>
  );
};

export default Learn;
