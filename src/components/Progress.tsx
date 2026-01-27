import React from 'react';
import { Icons } from './Icon';

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
  return (
    <div className="h-full overflow-y-auto bg-paper p-6 pb-24 font-hand">
      <div className="mb-8 border-b-2 border-pencil border-dashed pb-4">
        <h2 className="text-4xl font-heading text-pencil transform -rotate-1">Your Progress</h2>
        <p className="text-pencil text-lg">Keep up the momentum!</p>
      </div>

      <div className="grid grid-cols-1 gap-6 mb-8">
        <StatCard
          label="Current Streak"
          value="3 Days"
          color="bg-sketch-orange text-pencil"
          icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>}
        />
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            label="Lessons"
            value="5"
            color="bg-sketch-blue text-pencil"
            icon={<Icons.BookOpen />}
          />
          <StatCard
            label="Critiques"
            value="12"
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
          {[40, 70, 30, 85, 50, 60, 20].map((h, i) => (
            <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
              <div
                className="w-full bg-sketch-blue/30 border-2 border-pencil border-b-0 rounded-t-sm relative overflow-hidden transition-all duration-300 group-hover:bg-sketch-blue/50"
                style={{ height: `${h}%` }}
              >
                <div className="absolute top-0 left-0 w-full h-[2px] bg-pencil/10"></div>
              </div>
              <span className="text-sm text-pencil font-bold">{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Progress;
