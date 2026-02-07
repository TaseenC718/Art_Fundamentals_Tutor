import React, { useState } from 'react';
import { generateLesson } from '../services/geminiService';
import MarkdownRenderer from './MarkdownRenderer';
import { Icons } from './Icon';

const LESSON_TOPICS = [
  { id: '1point', title: '1-Point Perspective', desc: 'Drawing cubes with a single vanishing point. Front face is flat.', color: 'bg-sketch-blue/20 text-sketch-blue' },
  { id: '2point', title: '2-Point Perspective', desc: 'Drawing cubes at an angle. Two vanishing points on the horizon.', color: 'bg-sketch-red/20 text-sketch-red' },
  { id: '3point', title: '3-Point Perspective', desc: 'Extreme heights or depths. Three vanishing points.', color: 'bg-sketch-orange/20 text-sketch-orange' },
  { id: 'horizon', title: 'Horizon & Eye Level', desc: 'Understanding how camera height affects the cube\'s visibility.', color: 'bg-pencil/10 text-pencil' },
  { id: 'rotation', title: 'Rotating Cubes', desc: 'How vanishing points move when a cube rotates.', color: 'bg-sketch-yellow/50 text-pencil' },
  { id: 'shadows', title: 'Cast Shadows', desc: 'Plotting shadows of a cube onto the ground plane.', color: 'bg-sketch-blue/10 text-sketch-blue' },
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
      <div className="h-full overflow-y-auto bg-paper p-4 md:p-8 font-hand">
        <div className="max-w-3xl mx-auto bg-white rounded-sm shadow-sketch border-2 border-pencil min-h-[500px] flex flex-col relative">
          <div className="absolute top-0 right-0 w-8 h-8 bg-sketch-yellow border-l-2 border-b-2 border-pencil"></div>
          <div className="p-4 border-b-2 border-pencil border-dashed flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
            <button onClick={handleBack} className="text-sm font-bold text-pencil hover:text-sketch-orange flex items-center gap-1">
              ΓåÉ Back to Library
            </button>
            <span className="text-xs font-bold text-pencil/50 uppercase tracking-widest">Lesson Mode</span>
          </div>

          <div className="p-6 md:p-10 flex-1">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-64 space-y-4">
                <div className="animate-spin text-sketch-orange">
                  <Icons.Loader />
                </div>
                <p className="text-pencil font-hand text-xl animate-pulse">Constructing perspective guide...</p>
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
    <div className="h-full overflow-y-auto bg-paper p-4 md:p-8 font-hand">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="space-y-2 text-center">
          <h2 className="text-4xl font-heading text-pencil transform -rotate-1 decoration-sketch-yellow decoration-4 underline underline-offset-4">Cube Library</h2>
          <p className="text-pencil text-lg">Master the geometry of the cube with these focused lessons.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {LESSON_TOPICS.map((topic, index) => (
            <button
              key={topic.id}
              onClick={() => handleLessonSelect(topic.id, topic.title)}
              className={`group text-left bg-white p-6 rounded-sm shadow-sketch border-2 border-pencil hover:shadow-sketch-hover hover:-translate-y-1 transition-all duration-200 flex flex-col gap-4 relative ${index % 2 === 0 ? 'rotate-1' : '-rotate-1'}`}
            >
              <div className={`w-12 h-12 rounded-full border-2 border-pencil flex items-center justify-center ${topic.color}`}>
                <Icons.BookOpen />
              </div>
              <div>
                <h3 className="text-xl font-heading font-bold text-pencil group-hover:text-sketch-orange transition-colors">{topic.title}</h3>
                <p className="text-lg text-pencil/80 mt-1 leading-relaxed">{topic.desc}</p>
              </div>
              <div className="mt-auto pt-4 text-sketch-blue font-bold text-sm transform transition-all group-hover:translate-x-2">
                Start Guide ΓåÆ
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default LessonHub;
