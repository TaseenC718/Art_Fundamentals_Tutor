import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { getDifficulty, setDifficulty, Difficulty, DIFFICULTY_CONFIG } from '../services/storageService';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
  onDifficultyChange?: (difficulty: Difficulty) => void;
}

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose, onDifficultyChange }) => {
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('intermediate');

  useEffect(() => {
    if (isOpen) {
      setSelectedDifficulty(getDifficulty());
    }
  }, [isOpen]);

  const handleDifficultyChange = (difficulty: Difficulty) => {
    setSelectedDifficulty(difficulty);
    setDifficulty(difficulty);
    onDifficultyChange?.(difficulty);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-pencil/50 z-50 flex items-center justify-center p-4">
      <div className="bg-paper border-4 border-pencil rounded-sm shadow-sketch max-w-md w-full max-h-[90vh] overflow-y-auto transform rotate-1">
        <div className="bg-sketch-blue border-b-4 border-pencil p-4 flex items-center justify-between">
          <h2 className="text-2xl font-heading text-pencil">Settings</h2>
          <button
            onClick={onClose}
            className="w-10 h-10 bg-paper border-2 border-pencil rounded-full flex items-center justify-center hover:bg-sketch-red hover:text-paper transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-xl font-heading text-pencil mb-4 border-b-2 border-pencil border-dashed pb-2">
              Experience Level
            </h3>
            <p className="text-pencil/70 text-sm mb-4 font-hand">
              Choose your skill level to customize guides and AI feedback.
            </p>

            <div className="space-y-3">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((difficulty) => {
                const config = DIFFICULTY_CONFIG[difficulty];
                const isSelected = selectedDifficulty === difficulty;

                return (
                  <button
                    key={difficulty}
                    onClick={() => handleDifficultyChange(difficulty)}
                    className={`w-full text-left p-4 rounded-sm border-2 transition-all duration-200 ${
                      isSelected
                        ? 'bg-sketch-yellow border-pencil shadow-sketch'
                        : 'bg-white border-pencil/50 hover:border-pencil hover:bg-sketch-yellow/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? 'border-pencil bg-sketch-orange' : 'border-pencil/50'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-pencil" />}
                      </div>
                      <div className="flex-1">
                        <p className="font-heading text-lg text-pencil">{config.label}</p>
                        <p className="text-sm text-pencil/60 font-hand">{config.description}</p>
                      </div>
                    </div>

                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-pencil/20 text-sm font-hand text-pencil/70">
                        <ul className="space-y-1">
                          <li>
                            {config.showGuides ? '✓' : '✗'} Perspective guides{' '}
                            {config.showGuides ? 'visible' : 'hidden'}
                          </li>
                          <li>
                            {config.showVanishingPoints ? '✓' : '✗'} Vanishing points{' '}
                            {config.showVanishingPoints ? 'shown' : 'hidden'}
                          </li>
                          <li>
                            AI feedback:{' '}
                            {config.feedbackDetail === 'detailed'
                              ? 'Detailed explanations'
                              : config.feedbackDetail === 'standard'
                              ? 'Balanced feedback'
                              : 'Concise tips'}
                          </li>
                        </ul>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t-2 border-pencil border-dashed">
            <button
              onClick={onClose}
              className="w-full bg-sketch-blue border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-blue/80 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
