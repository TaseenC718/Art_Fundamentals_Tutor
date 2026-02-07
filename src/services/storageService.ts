import { format } from 'date-fns'; 

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
  profilePicture?: string;
  name: string;
  //Store the specific tasks assigned for today so they don't change on refresh
  currentDailyTasks?: DailyTask[]; 
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
  profilePicture: undefined,
  name: 'Guest Artist',
  currentDailyTasks: [], // Initialize empty
};

const DEFAULT_SETTINGS: UserSettings = {
  difficulty: 'intermediate',
};


const TASK_POOL: { id: number; text: string }[] = [
  { id: 1, text: "Draw 3 cubes in 1-Point Perspective" },
  { id: 2, text: "Draw a 'Transparent' Cube" },
  { id: 3, text: "Sketch a floating cube" },
  { id: 4, text: "Draw a cube with a cast shadow" },
  { id: 5, text: "Draw 3 overlapping cubes" },
  { id: 6, text: "Draw a very tall 'skyscraper' cube" },
  { id: 7, text: "Draw a cube from a 'worm's eye' view" },
  { id: 8, text: "Draw a cube from a 'bird's eye' view" },
  { id: 9, text: "Fill a page with rotating cubes" },
  { id: 10, text: "Draw a cube with one side removed" },
  { id: 11, text: "Draw a 2-Point perspective street corner" },
  { id: 12, text: "Draw a cube balanced on its edge" },
  { id: 13, text: "Draw a 'ribbon' twisting in perspective" },
  { id: 14, text: "Draw a table using basic boxes" },
  { id: 15, text: "Stack 5 cubes vertically" },
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

// --- UPDATED: Randomize tasks daily ---
export function getDailyTasks(): DailyTask[] {
  const progress = getProgress();
  const today = new Date().toDateString();

  // If it's a new day (or if they have no tasks assigned yet), generate new ones
  if (progress.lastPracticeDate !== today || !progress.currentDailyTasks || progress.currentDailyTasks.length === 0) {
    
    // 1. Shuffle the pool
    const shuffled = [...TASK_POOL].sort(() => 0.5 - Math.random());
    
    // 2. Pick the first 3
    const selected = shuffled.slice(0, 3).map(t => ({
      ...t,
      completed: false
    }));

    // 3. Save these to the user's progress
    progress.currentDailyTasks = selected;
    progress.completedTaskIds = []; // Reset completions for the new day
    
    // Note: We don't update lastPracticeDate here yet; that happens when they *do* something.
    // But we do need to save the assigned tasks.
    saveProgress(progress);
    
    return selected;
  }

  // If tasks already exist for today, return them with current completion status
  return progress.currentDailyTasks.map(t => ({
    ...t,
    completed: progress.completedTaskIds.includes(t.id)
  }));
}

export function toggleTask(taskId: number): { tasks: DailyTask[]; xpGained: number } {
  const progress = getProgress();
  const today = new Date().toDateString();
  let xpGained = 0;

  // Edge Case: If they toggle a task but the date has changed since they loaded the page
  if (progress.lastPracticeDate !== today && progress.lastPracticeDate !== null) {
     // This handles the "Midnight crossover" edge case if needed, 
     // but generally getDailyTasks handles the reset on load.
     progress.lastPracticeDate = today; 
     updateStreak(progress);
  }
  
  // Update last practice date on first action of the day
  if (progress.lastPracticeDate !== today) {
    progress.lastPracticeDate = today;
    updateStreak(progress);
  }

  const wasCompleted = progress.completedTaskIds.includes(taskId);

  if (wasCompleted) {
    // Uncomplete
    progress.completedTaskIds = progress.completedTaskIds.filter(id => id !== taskId);
    progress.xp = Math.max(0, progress.xp - XP_PER_TASK);
    xpGained = -XP_PER_TASK;
  } else {
    // Complete
    progress.completedTaskIds.push(taskId);
    progress.xp += XP_PER_TASK;
    xpGained = XP_PER_TASK;

    // Update weekly activity
    const dayIndex = new Date().getDay();
    progress.weeklyActivity[dayIndex] = Math.min(100, progress.weeklyActivity[dayIndex] + 15);
  }

  // Recalculate level
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

  // IMPORTANT: Update the 'currentDailyTasks' completion status in the saved object too
  // so it persists if we rely on that field
  if (progress.currentDailyTasks) {
    progress.currentDailyTasks = progress.currentDailyTasks.map(t => 
      t.id === taskId ? { ...t, completed: !wasCompleted } : t
    );
  }

  saveProgress(progress);

  return {
    tasks: progress.currentDailyTasks || [],
    xpGained,
  };
}

function updateStreak(progress: UserProgress): void {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  // Helper to compare dates without time
  const isSameDate = (d1: Date, d2String: string | null) => {
    if (!d2String) return false;
    return d1.toDateString() === d2String;
  };

  if (isSameDate(yesterday, progress.lastPracticeDate)) {
    progress.streak += 1;
  } else if (!isSameDate(today, progress.lastPracticeDate)) {
    // If last practice wasn't today and wasn't yesterday, reset
    progress.streak = 1;
  }
}

export function recordCritique(): { xpGained: number; totalCritiques: number } {
  const progress = getProgress();
  const today = new Date().toDateString();

  if (progress.lastPracticeDate !== today) {
    updateStreak(progress);
    progress.lastPracticeDate = today;
  }

  progress.totalCritiques += 1;
  progress.xp += XP_PER_CRITIQUE;
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

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

// Settings functions (Keep as is)
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