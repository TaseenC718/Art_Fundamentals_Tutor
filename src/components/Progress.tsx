import React, { useState, useEffect } from 'react';
import { getProgress, UserProgress, CritiqueRecord } from '../services/storageService';
import { X, ZoomIn, Calendar, Camera } from 'lucide-react';
import MarkdownRenderer from './MarkdownRenderer';

const CritiqueCard = ({ record, onClick }: { record: CritiqueRecord; onClick: () => void }) => {
  // Determine border color based on grade
  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'border-green-500 text-green-600 bg-green-50';
    if (grade.startsWith('B')) return 'border-blue-500 text-blue-600 bg-blue-50';
    if (grade.startsWith('C')) return 'border-yellow-500 text-yellow-600 bg-yellow-50';
    return 'border-red-500 text-red-600 bg-red-50';
  };

  const gradeColorClass = getGradeColor(record.grade);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white rounded-sm shadow-sketch border-2 border-pencil overflow-hidden cursor-pointer hover:-translate-y-1 hover:shadow-sketch-hover transition-all duration-200"
    >
      <div className="aspect-square w-full relative overflow-hidden bg-gray-100">
        <img
          src={record.thumbnail}
          alt={`Critique from ${record.date}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
          <ZoomIn className="text-white opacity-0 group-hover:opacity-100 transform scale-50 group-hover:scale-100 transition-all duration-300" size={32} />
        </div>
      </div>

      <div className="absolute top-2 right-2">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 font-heading text-xl shadow-sm ${gradeColorClass}`}>
          {record.grade.charAt(0)}
        </div>
      </div>

      <div className="p-3 border-t-2 border-pencil/10">
        <div className="flex items-center gap-2 text-pencil/60 text-xs font-bold font-hand uppercase tracking-wider">
          <Calendar size={12} />
          {record.date}
        </div>
      </div>
    </div>
  );
};

const CritiqueModal = ({ record, onClose }: { record: CritiqueRecord; onClose: () => void }) => {
  if (!record) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-pencil/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-paper w-full max-w-4xl max-h-[90vh] rounded-xl border-4 border-pencil shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="p-4 border-b-2 border-pencil border-dashed flex justify-between items-center bg-white sticky top-0 z-10">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-heading text-pencil">Critique Details</h2>
            <span className="text-sm font-hand px-3 py-1 bg-sketch-blue/20 rounded-full border border-sketch-blue text-pencil uppercase font-bold">
              {record.date}
            </span>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-sketch-red hover:text-white rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Col: Image */}
          <div className="space-y-4">
            <div className="aspect-square md:aspect-[4/3] w-full rounded-lg border-2 border-pencil shadow-sketch bg-white p-2">
              <img src={record.thumbnail} alt="Full drawing" className="w-full h-full object-contain" />
            </div>
            <div className="flex justify-center">
              <div className="inline-flex flex-col items-center bg-white px-8 py-4 rounded-lg border-2 border-pencil shadow-sm transform -rotate-1">
                <span className="text-sm font-bold text-pencil/50 uppercase tracking-widest mb-1">Grade</span>
                <span className={`text-6xl font-heading ${record.grade.startsWith('A') ? 'text-green-500' :
                  record.grade.startsWith('B') ? 'text-blue-500' :
                    record.grade.startsWith('C') ? 'text-yellow-500' : 'text-red-500'
                  }`}>{record.grade}</span>
              </div>
            </div>
          </div>

          {/* Right Col: Feedback */}
          <div className="bg-white rounded-lg border-2 border-pencil p-6 shadow-sm overflow-y-auto">
            <h3 className="font-heading text-xl text-pencil mb-4 border-b-2 border-pencil/20 pb-2">Feedback</h3>
            <div className="prose prose-pencil font-hand">
              <MarkdownRenderer content={record.feedback} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Progress: React.FC = () => {
  const [progress, setProgress] = useState<UserProgress | null>(null);
  const [selectedCritique, setSelectedCritique] = useState<CritiqueRecord | null>(null);

  useEffect(() => {
    setProgress(getProgress());
  }, []);

  if (!progress) return null;

  return (
    <div className="h-full overflow-y-auto bg-paper p-6 pb-24 font-hand">
      <div className="mb-8 border-b-2 border-pencil border-dashed pb-4 flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-4xl font-heading text-pencil transform -rotate-1 mb-2">Art Gallery</h2>
          <p className="text-pencil text-lg max-w-xl">
            Review your past critiques and track your improvement over time.
          </p>
        </div>
        <div className="bg-sketch-yellow px-4 py-2 rounded-sm border-2 border-pencil shadow-sm transform rotate-1 mr-12">
          <span className="font-bold text-pencil uppercase text-sm tracking-wide">Total Critiques</span>
          <p className="text-3xl font-heading text-sketch-orange text-center">{progress.totalCritiques}</p>
        </div>
      </div>

      {(!progress.critiqueHistory || progress.critiqueHistory.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
          <div className="w-24 h-24 bg-pencil/10 rounded-full flex items-center justify-center mb-4">
            <Camera size={48} className="text-pencil/40" />
          </div>
          <h3 className="text-xl font-bold text-pencil mb-2">No Critiques Yet</h3>
          <p className="text-pencil/70 max-w-sm">
            Complete a practice session in the "Practice" tab to see your work appear here!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {progress.critiqueHistory.map((record) => (
            <CritiqueCard
              key={record.id}
              record={record}
              onClick={() => setSelectedCritique(record)}
            />
          ))}
        </div>
      )}

      {selectedCritique && (
        <CritiqueModal
          record={selectedCritique}
          onClose={() => setSelectedCritique(null)}
        />
      )}
    </div>
  );
};

export default Progress;
