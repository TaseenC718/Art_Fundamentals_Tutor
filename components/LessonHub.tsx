import React, { useState } from 'react';
import { generateLesson } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Icons } from './Icon';

const LESSON_TOPICS = [
  { id: '1point', title: '1-Point Perspective', desc: 'Drawing cubes with a single vanishing point. Front face is flat.', color: 'bg-blue-100 text-blue-700' },
  { id: '2point', title: '2-Point Perspective', desc: 'Drawing cubes at an angle. Two vanishing points on the horizon.', color: 'bg-red-100 text-red-700' },
  { id: '3point', title: '3-Point Perspective', desc: 'Extreme heights or depths. Three vanishing points.', color: 'bg-amber-100 text-amber-700' },
  { id: 'horizon', title: 'Horizon & Eye Level', desc: 'Understanding how camera height affects the cube\'s visibility.', color: 'bg-neutral-100 text-neutral-700' },
  { id: 'rotation', title: 'Rotating Cubes', desc: 'How vanishing points move when a cube rotates.', color: 'bg-emerald-100 text-emerald-700' },
  { id: 'shadows', title: 'Cast Shadows', desc: 'Plotting shadows of a cube onto the ground plane.', color: 'bg-purple-100 text-purple-700' },
];

const LessonHub: React.FC = () => {
  const [activeLesson, setActiveLesson] = useState<string | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLessonSelect = async (topicId: string, title: string) => {
    setActiveLesson(topicId);
    setContent(null);
    setLoading(true);
    
    try {
        const text = await generateLesson(title);
        setContent(text);
    } catch (e) {
        setContent("Could not load lesson.");
    } finally {
        setLoading(false);
    }
  };

  const handleBack = () => {
    setActiveLesson(null);
    setContent(null);
  };

  if (activeLesson) {
    return (
      <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
         <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm border border-slate-200 min-h-[500px] flex flex-col">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm rounded-t-2xl z-10">
                <button onClick={handleBack} className="text-sm font-medium text-slate-500 hover:text-indigo-600 flex items-center gap-1">
                    ← Back to Library
                </button>
                <span className="text-xs font-mono text-slate-400 uppercase tracking-widest">Lesson Mode</span>
            </div>
            
            <div className="p-6 md:p-10 flex-1">
                {loading ? (
                    <div className="flex flex-col items-center justify-center h-64 space-y-4">
                        <div className="animate-spin text-indigo-600">
                             <Icons.Loader />
                        </div>
                        <p className="text-slate-500 font-serif italic">Constructing perspective guide...</p>
                    </div>
                ) : (
                    <MarkdownRenderer content={content || ''} />
                )}
            </div>
         </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2">
            <h2 className="text-3xl font-serif text-slate-900">Cube Library</h2>
            <p className="text-slate-600">Master the geometry of the cube with these focused lessons.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {LESSON_TOPICS.map((topic) => (
                <button
                    key={topic.id}
                    onClick={() => handleLessonSelect(topic.id, topic.title)}
                    className="group text-left bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md hover:border-indigo-300 transition-all duration-200 flex flex-col gap-4"
                >
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${topic.color}`}>
                        <Icons.BookOpen />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors">{topic.title}</h3>
                        <p className="text-sm text-slate-500 mt-1 leading-relaxed">{topic.desc}</p>
                    </div>
                    <div className="mt-auto pt-2 text-indigo-600 text-sm font-medium opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all">
                        Start Guide →
                    </div>
                </button>
            ))}
        </div>
      </div>
    </div>
  );
};

export default LessonHub;
