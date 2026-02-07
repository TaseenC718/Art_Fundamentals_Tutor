const STORAGE_KEY = 'art-tutor-progress';
const SETTINGS_KEY = 'art-tutor-settings';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface DailyTask {
  id: number;
  text: string;
  completed: boolean;
}

export interface UserProgress {
  xp: number;
  level: number;
  streak: number;
  lastPracticeDate: string | null;
  totalCritiques: number;
  totalLessons: number;
  completedTaskIds: number[];
  weeklyActivity: number[]; // Last 7 days of practice minutes/sessions
}

export interface UserSettings {
  difficulty: Difficulty;
}

const DEFAULT_PROGRESS: UserProgress = {
  xp: 0,
  level: 1,
  streak: 0,
  lastPracticeDate: null,
  totalCritiques: 0,
  totalLessons: 0,
  completedTaskIds: [],
  weeklyActivity: [0, 0, 0, 0, 0, 0, 0],
};

const DEFAULT_SETTINGS: UserSettings = {
  difficulty: 'intermediate',
};

const DAILY_TASKS: DailyTask[] = [
  { id: 1, text: "Draw 3 cubes in 1-Point Perspective", completed: false },
  { id: 2, text: "Draw a 'Transparent' Cube", completed: false },
  { id: 3, text: "Sketch a floating cube", completed: false },
];

// XP rewards
const XP_PER_TASK = 50;
const XP_PER_CRITIQUE = 100;
const XP_PER_LESSON = 75;
const XP_PER_LEVEL = 500;

export function getProgress(): UserProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return { ...DEFAULT_PROGRESS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load progress:', e);
  }
  return { ...DEFAULT_PROGRESS };
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress:', e);
  }
}

export function getDailyTasks(): DailyTask[] {
  const progress = getProgress();
  const today = new Date().toDateString();

  // Reset tasks if it's a new day
  if (progress.lastPracticeDate !== today) {
    return DAILY_TASKS.map(t => ({ ...t, completed: false }));
  }

  return DAILY_TASKS.map(t => ({
    ...t,
    completed: progress.completedTaskIds.includes(t.id),
  }));
}

export function toggleTask(taskId: number): { tasks: DailyTask[]; xpGained: number } {
  const progress = getProgress();
  const today = new Date().toDateString();
  let xpGained = 0;

  // Check if starting a new day
  if (progress.lastPracticeDate !== today) {
    progress.completedTaskIds = [];
    progress.lastPracticeDate = today;
    updateStreak(progress);
  }

  const wasCompleted = progress.completedTaskIds.includes(taskId);

  if (wasCompleted) {
    // Uncomplete - remove from list, deduct XP
    progress.completedTaskIds = progress.completedTaskIds.filter(id => id !== taskId);
    progress.xp = Math.max(0, progress.xp - XP_PER_TASK);
    xpGained = -XP_PER_TASK;
  } else {
    // Complete - add to list, award XP
    progress.completedTaskIds.push(taskId);
    progress.xp += XP_PER_TASK;
    xpGained = XP_PER_TASK;

    // Update weekly activity
    const dayIndex = new Date().getDay();
    progress.weeklyActivity[dayIndex] = Math.min(100, progress.weeklyActivity[dayIndex] + 15);
  }

  // Recalculate level
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

  saveProgress(progress);

  return {
    tasks: getDailyTasks(),
    xpGained,
  };
}

function updateStreak(progress: UserProgress): void {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (progress.lastPracticeDate === yesterday.toDateString()) {
    // Practiced yesterday, continue streak
    progress.streak += 1;
  } else if (progress.lastPracticeDate !== today.toDateString()) {
    // Missed a day, reset streak
    progress.streak = 1;
  }
}

export function recordCritique(): { xpGained: number; totalCritiques: number } {
  const progress = getProgress();
  const today = new Date().toDateString();

  // Update last practice date and streak if needed
  if (progress.lastPracticeDate !== today) {
    updateStreak(progress);
    progress.lastPracticeDate = today;
  }

  progress.totalCritiques += 1;
  progress.xp += XP_PER_CRITIQUE;
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

  // Update weekly activity
  const dayIndex = new Date().getDay();
  progress.weeklyActivity[dayIndex] = Math.min(100, progress.weeklyActivity[dayIndex] + 25);

  saveProgress(progress);

  return {
    xpGained: XP_PER_CRITIQUE,
    totalCritiques: progress.totalCritiques,
  };
}

export function recordLesson(): { xpGained: number; totalLessons: number } {
  const progress = getProgress();

  progress.totalLessons += 1;
  progress.xp += XP_PER_LESSON;
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

  saveProgress(progress);

  return {
    xpGained: XP_PER_LESSON,
    totalLessons: progress.totalLessons,
  };
}

export function getLevelTitle(level: number): string {
  if (level <= 2) return 'Cube Curious';
  if (level <= 5) return 'Perspective Novice';
  if (level <= 10) return 'Box Builder';
  if (level <= 15) return 'Dimension Explorer';
  if (level <= 20) return 'Vanishing Point Veteran';
  return 'Perspective Master';
}

// Settings functions
export function getSettings(): UserSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save settings:', e);
  }
}

export function setDifficulty(difficulty: Difficulty): void {
  const settings = getSettings();
  settings.difficulty = difficulty;
  saveSettings(settings);
}

export function getDifficulty(): Difficulty {
  return getSettings().difficulty;
}

// Difficulty configuration
export const DIFFICULTY_CONFIG = {
  beginner: {
    label: 'Beginner',
    description: 'All guides visible, simpler feedback',
    showGuides: true,
    showVanishingPoints: true,
    showHorizon: true,
    feedbackDetail: 'detailed',
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Standard guides, balanced feedback',
    showGuides: true,
    showVanishingPoints: true,
    showHorizon: true,
    feedbackDetail: 'standard',
  },
  advanced: {
    label: 'Advanced',
    description: 'Minimal guides, concise feedback',
    showGuides: false,
    showVanishingPoints: false,
    showHorizon: true,
    feedbackDetail: 'concise',
  },
} as const;
