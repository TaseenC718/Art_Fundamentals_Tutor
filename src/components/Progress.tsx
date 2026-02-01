import React, { useState, useEffect } from 'react';
import { Icons } from './Icon';
import { getProgress, UserProgress } from '../services/storageService';

const StatCard = ({ label, value, color, icon }: any) => (
  <div className="bg-white p-5 rounded-sm shadow-sketch border-2 border-pencil flex items-center gap-4 transform rotate-1 hover:-rotate-1 transition-all">
    <div className={`w-12 h-12 rounded-full border-2 border-pencil flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-3xl font-heading text-pencil">{value}</p>
      <p className="text-sm text-pencil/60 uppercase tracking-wide font-bold font-hand">{label}</p>
    </div>
  </div>
);

const Progress: React.FC = () => {
  const [progress, setProgress] = useState<UserProgress | null>(null);

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  if (!progress) return null;

  // Reorder weekly activity to start from Monday (index 1) and end with Sunday (index 0)
  const reorderedActivity = [
    progress.weeklyActivity[1], // Monday
    progress.weeklyActivity[2], // Tuesday
    progress.weeklyActivity[3], // Wednesday
    progress.weeklyActivity[4], // Thursday
    progress.weeklyActivity[5], // Friday
    progress.weeklyActivity[6], // Saturday
    progress.weeklyActivity[0], // Sunday
  ];

  return (
    <div className="h-full overflow-y-auto bg-paper p-6 pb-24 font-hand">
      <div className="mb-8 border-b-2 border-pencil border-dashed pb-4">
        <h2 className="text-4xl font-heading text-pencil transform -rotate-1">Your Progress</h2>
        <p className="text-pencil text-lg">
          {progress.streak > 0 ? `${progress.streak} day streak! Keep it up!` : 'Start practicing to build your streak!'}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <StatCard
          label="Current Streak"
          value={`${progress.streak} Day${progress.streak !== 1 ? 's' : ''}`}
          color="bg-sketch-orange text-pencil"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>}
        />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Lessons"
            value={progress.totalLessons}
            color="bg-sketch-blue text-pencil"
            icon={<Icons.BookOpen />}
          />
          <StatCard
            label="Critiques"
            value={progress.totalCritiques}
            color="bg-sketch-yellow text-pencil"
            icon={<Icons.Camera />}
          />
        </div>
      </div>

      <div className="bg-white p-6 rounded-sm shadow-sketch border-2 border-pencil relative">
        <div className="absolute -top-2 -left-2 w-4 h-4 rounded-full bg-pencil"></div>
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-pencil"></div>
        <h3 className="font-heading text-2xl text-pencil mb-4">Weekly Activity</h3>
        <div className="flex items-end justify-between h-32 gap-2 border-b-2 border-pencil pb-0">
          {reorderedActivity.map((activity, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
              <div
                className={`w-full border-2 border-pencil border-b-0 rounded-t-sm relative overflow-hidden transition-all duration-300 ${
                  activity > 0 ? 'bg-sketch-blue/30 group-hover:bg-sketch-blue/50' : 'bg-gray-100'
                }`}
                style={{ height: `${Math.max(activity, 5)}%` }}
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-pencil/10"></div>
              </div>
              <span className="text-sm text-pencil font-bold">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            </div>
          ))}
        </div>
        {progress.totalCritiques === 0 && progress.totalLessons === 0 && (
          <p className="text-center text-pencil/50 mt-4 text-sm">
            Complete critiques and lessons to see your activity!
          </p>
        )}
      </div>
    </div>
  );
};

export default Progress;
