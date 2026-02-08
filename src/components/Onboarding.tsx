import React, { useState, useEffect, useRef } from 'react';
import { Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Difficulty,
  DIFFICULTY_CONFIG,
  updateProfile,
  setDifficulty,
  setOnboardingCompleted,
} from '../services/storageService';

type Phase = 'name' | 'avatar' | 'difficulty';

interface OnboardingProps {
  onComplete: (difficulty: Difficulty) => void;
}

const Mascot = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 200 200" className={className}>
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

const StepDots = ({ current }: { current: number }) => (
  <div className="flex items-center justify-center gap-3 mb-8">
    {[1, 2, 3].map((step) => (
      <div
        key={step}
        className={`w-3 h-3 rounded-full border-2 border-pencil transition-all duration-300 ${
          step <= current ? 'bg-sketch-orange scale-110' : 'bg-white'
        }`}
      />
    ))}
  </div>
);

const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
  const [phase, setPhase] = useState<Phase>('name');
  const [stepVisible, setStepVisible] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('default');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('intermediate');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fade in the first step on mount
  useEffect(() => {
    const timer = setTimeout(() => setStepVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const goToPhase = (next: Phase) => {
    setStepVisible(false);
    setTimeout(() => {
      setPhase(next);
      setStepVisible(true);
    }, 200);
  };

  const handleAvatarUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFinish = () => {
    const finalName = name.trim() || 'Artist';
    updateProfile(finalName, avatar);
    setDifficulty(selectedDifficulty);
    setOnboardingCompleted();
    onComplete(selectedDifficulty);
  };

  return (
    <div className="fixed inset-0 bg-paper z-[100] flex flex-col items-center justify-center p-6 overflow-y-auto">
      <div
        className={`w-full max-w-md transition-all duration-300 ${
          stepVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        {/* Name Step */}
        {phase === 'name' && (
          <div className="text-center">
            <StepDots current={1} />
            <Mascot className="w-24 h-24 mx-auto mb-4 filter drop-shadow-[3px_3px_0px_rgba(45,45,45,1)]" />
            <h2 className="text-2xl font-heading text-pencil mb-2 transform -rotate-1">
              What should I call you?
            </h2>
            <p className="text-pencil/60 font-hand mb-6">
              Pick a name for your art journey
            </p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name..."
              className="w-full px-4 py-3 border-2 border-pencil rounded-sm font-hand text-lg text-center focus:outline-none focus:border-sketch-orange focus:ring-1 focus:ring-sketch-orange bg-white"
              autoFocus
            />
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={() => goToPhase('avatar')}
                disabled={!name.trim()}
                className="w-full bg-sketch-orange border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-orange/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                Next <ChevronRight size={20} />
              </button>
              <button
                onClick={() => {
                  setName('Artist');
                  goToPhase('avatar');
                }}
                className="text-pencil/50 font-hand text-sm hover:text-pencil/80 transition-colors underline decoration-dashed"
              >
                Skip (use "Artist")
              </button>
            </div>
          </div>
        )}

        {/* Avatar Step */}
        {phase === 'avatar' && (
          <div className="text-center">
            <StepDots current={2} />
            <h2 className="text-2xl font-heading text-pencil mb-2 transform rotate-1">
              Add a profile picture
            </h2>
            <p className="text-pencil/60 font-hand mb-6">
              Optional - you can always change this later
            </p>

            <div
              className="relative mx-auto w-32 h-32 rounded-full border-2 border-dashed border-pencil bg-white shadow-sketch cursor-pointer group hover:border-sketch-orange transition-colors overflow-hidden"
              onClick={() => fileInputRef.current?.click()}
            >
              {avatar === 'default' ? (
                <div className="w-full h-full flex flex-col items-center justify-center text-pencil/40 group-hover:text-sketch-orange transition-colors">
                  <Camera size={32} />
                  <span className="text-xs font-hand mt-1">Tap to upload</span>
                </div>
              ) : (
                <>
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={24} className="text-white" />
                  </div>
                </>
              )}
            </div>
            <input
              type="file"
              ref={fileInputRef}
              className="hidden"
              accept="image/*"
              onChange={handleAvatarUpload}
            />

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => goToPhase('name')}
                className="flex-1 bg-white border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-yellow/20 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={() => goToPhase('difficulty')}
                className="flex-1 bg-sketch-orange border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-orange/80 transition-colors flex items-center justify-center gap-1"
              >
                {avatar === 'default' ? 'Skip' : 'Next'} <ChevronRight size={20} />
              </button>
            </div>
          </div>
        )}

        {/* Difficulty Step */}
        {phase === 'difficulty' && (
          <div className="text-center">
            <StepDots current={3} />
            <h2 className="text-2xl font-heading text-pencil mb-2 transform -rotate-1">
              Choose your level
            </h2>
            <p className="text-pencil/60 font-hand mb-6">
              This adjusts AI feedback and guides
            </p>

            <div className="space-y-3 text-left">
              {(Object.keys(DIFFICULTY_CONFIG) as Difficulty[]).map((difficulty) => {
                const config = DIFFICULTY_CONFIG[difficulty];
                const isSelected = selectedDifficulty === difficulty;

                return (
                  <button
                    key={difficulty}
                    onClick={() => setSelectedDifficulty(difficulty)}
                    className={`w-full text-left p-4 rounded-sm border-2 transition-all duration-200 ${
                      isSelected
                        ? 'bg-sketch-yellow border-pencil shadow-sketch'
                        : 'bg-white border-pencil/50 hover:border-pencil hover:bg-sketch-yellow/20'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
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
                  </button>
                );
              })}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => goToPhase('avatar')}
                className="flex-1 bg-white border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-yellow/20 transition-colors flex items-center justify-center gap-1"
              >
                <ChevronLeft size={20} /> Back
              </button>
              <button
                onClick={handleFinish}
                className="flex-1 bg-sketch-orange border-2 border-pencil text-pencil font-heading text-lg py-3 rounded-sm shadow-sketch hover:bg-sketch-orange/80 transition-colors"
              >
                Let's Go!
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Onboarding;
