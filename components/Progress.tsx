import React from 'react';
import { Icons } from './Icon';

const StatCard = ({ label, value, color, icon }: any) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4">
    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${color}`}>
      {icon}
    </div>
    <div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
      <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">{label}</p>
    </div>
  </div>
);

const Progress: React.FC = () => {
  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 pb-24">
      <div className="mb-8">
        <h2 className="text-2xl font-serif text-slate-800">Your Progress</h2>
        <p className="text-slate-600">Keep up the momentum!</p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-8">
        <StatCard 
            label="Current Streak" 
            value="3 Days" 
            color="bg-orange-100 text-orange-600" 
            icon={<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>}
        />
        <div className="grid grid-cols-2 gap-4">
            <StatCard 
                label="Lessons" 
                value="5" 
                color="bg-blue-100 text-blue-600" 
                icon={<Icons.BookOpen />}
            />
            <StatCard 
                label="Critiques" 
                value="12" 
                color="bg-purple-100 text-purple-600" 
                icon={<Icons.Camera />}
            />
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="font-bold text-slate-800 mb-4">Weekly Activity</h3>
          <div className="flex items-end justify-between h-32 gap-2">
              {[40, 70, 30, 85, 50, 60, 20].map((h, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 flex-1 group">
                      <div 
                        className="w-full bg-indigo-100 rounded-t-lg relative overflow-hidden transition-all duration-300 group-hover:bg-indigo-200" 
                        style={{ height: `${h}%` }}
                      >
                         <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-400"></div>
                      </div>
                      <span className="text-xs text-slate-400 font-medium">{['M','T','W','T','F','S','S'][i]}</span>
                  </div>
              ))}
          </div>
      </div>
    </div>
  );
};

export default Progress;
