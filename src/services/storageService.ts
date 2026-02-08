const STORAGE_KEY = 'art-tutor-progress';
const SETTINGS_KEY = 'art-tutor-settings';

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export interface DailyTask {
  id: number;
  text: string;
  completed: boolean;
}

export interface CritiqueRecord {
  id: string; // timestamp
  date: string;
  thumbnail: string; // base64 user drawing
  grade: string;
  feedback: string;
  difficulty: Difficulty;
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
  displayName: string;
  avatar: string; // 'default' or base64
  activeTaskIds: number[];
  critiqueHistory: CritiqueRecord[];
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
  displayName: 'Artist',
  avatar: 'default',
  activeTaskIds: [1, 2, 3],
  critiqueHistory: [],
};

const DEFAULT_SETTINGS: UserSettings = {
  difficulty: 'intermediate',
};

// Extended Task Pool - Strictly Perspective Focused
const TASK_POOL: DailyTask[] = [
  { id: 1, text: "Draw 3 cubes in 1-Point Perspective", completed: false },
  { id: 2, text: "Draw a 'Transparent' Cube (show back lines)", completed: false },
  { id: 3, text: "Sketch a floating cube above the horizon", completed: false },
  { id: 4, text: "Draw a cube below the horizon (Bird's Eye)", completed: false },
  { id: 5, text: "Stack 3 cubes vertically in 2-Point Perspective", completed: false },
  { id: 6, text: "Draw a very wide, flat box", completed: false },
  { id: 7, text: "Draw a very tall, thin pillar", completed: false },
  { id: 8, text: "Draw 3 cubes rotating slightly each time", completed: false },
  { id: 9, text: "Draw a cube with a 'slice' taken out", completed: false },
  { id: 10, text: "Draw 2 overlapping cubes", completed: false },
  { id: 11, text: "Draw a cube in 3-Point Perspective", completed: false },
  { id: 12, text: "Fill the page with 5 random cubes", completed: false },
];

export function getTask(id: number): DailyTask | undefined {
  return TASK_POOL.find(t => t.id === id);
}

// XP rewards
const XP_PER_TASK = 50;
const XP_PER_CRITIQUE = 100;
const XP_PER_LESSON = 75;
const XP_PER_LEVEL = 500;

export function getProgress(): UserProgress {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return migrateProgress(JSON.parse(stored));
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

// Ensure activeTaskIds and critiqueHistory exist on load (migration)
function migrateProgress(progress: any): UserProgress {
  const defaults = { ...DEFAULT_PROGRESS };
  return {
    ...defaults,
    ...progress,
    activeTaskIds: progress.activeTaskIds || defaults.activeTaskIds,
    critiqueHistory: progress.critiqueHistory || defaults.critiqueHistory,
  };
}

export function getDailyTasks(): DailyTask[] {
  const progress = getProgress();

  // Initialize activeTaskIds if missing (migration)
  if (!progress.activeTaskIds || progress.activeTaskIds.length === 0) {
    progress.activeTaskIds = [1, 2, 3];
    saveProgress(progress);
  }

  return progress.activeTaskIds
    .map(id => getTask(id))
    .filter((t): t is DailyTask => !!t)
    .map(t => ({
      ...t,
      completed: progress.completedTaskIds.includes(t.id)
    }));
}

export function completeTask(taskId: number): { tasks: DailyTask[]; xpGained: number } {
  const progress = getProgress();
  const today = new Date().toDateString();
  let xpGained = 0;

  // Check if starting a new day
  if (progress.lastPracticeDate !== today) {
    progress.lastPracticeDate = today;
    updateStreak(progress);
  }

  // If already completed, ignore (UI shouldn't allow this, but for safety)
  if (progress.completedTaskIds.includes(taskId)) {
    return { tasks: getDailyTasks(), xpGained: 0 };
  }

  // Complete task
  progress.completedTaskIds.push(taskId);
  progress.xp += XP_PER_TASK;
  xpGained = XP_PER_TASK;

  // Update weekly activity
  const dayIndex = new Date().getDay();
  progress.weeklyActivity[dayIndex] = Math.min(100, progress.weeklyActivity[dayIndex] + 15);

  // Recalculate level
  progress.level = Math.floor(progress.xp / XP_PER_LEVEL) + 1;

  // REPLACE the completed task with a new one
  // Filter out the completed task from active list
  const activeWithoutCompleted = progress.activeTaskIds.filter(id => id !== taskId);

  // Find a new task that isn't currently active AND hasn't been completed today
  const availableTasks = TASK_POOL.filter(t =>
    !activeWithoutCompleted.includes(t.id) && // Not currently shown
    t.id !== taskId && // Not the one just finished
    !progress.completedTaskIds.includes(t.id) // Not already completed today
  );

  // Pick random new task
  if (availableTasks.length > 0) {
    const randomTask = availableTasks[Math.floor(Math.random() * availableTasks.length)];
    // Maintain order: replace the old ID with the new ID at the same index
    const index = progress.activeTaskIds.indexOf(taskId);
    if (index !== -1) {
      progress.activeTaskIds[index] = randomTask.id;
    } else {
      progress.activeTaskIds.push(randomTask.id);
    }
  }

  saveProgress(progress);

  return {
    tasks: getDailyTasks(),
    xpGained,
  };
}

export function updateProfile(displayName: string, avatar: string): void {
  const progress = getProgress();
  progress.displayName = displayName;
  progress.avatar = avatar;
  saveProgress(progress);
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

export function recordCritique(critiqueData?: Omit<CritiqueRecord, 'id' | 'date'>): { xpGained: number; totalCritiques: number } {
  const progress = getProgress();
  const today = new Date().toDateString();

  // Update last practice date and streak if needed
  if (progress.lastPracticeDate !== today) {
    updateStreak(progress);
    progress.lastPracticeDate = today;
  }

  // Save critique record if provided
  if (critiqueData) {
    const newRecord: CritiqueRecord = {
      ...critiqueData,
      id: Date.now().toString(),
      date: new Date().toLocaleDateString(),
    };

    // Add to history (newest first)
    progress.critiqueHistory = [newRecord, ...progress.critiqueHistory].slice(0, 50); // Keep last 50
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

export function resetProgress(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to reset progress:', e);
  }
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
    description: 'Lenient grading, encouraging feedback',
    showGuides: true,
    showVanishingPoints: true,
    showHorizon: true,
    feedbackDetail: 'detailed',
  },
  intermediate: {
    label: 'Intermediate',
    description: 'Standard grading, balanced feedback',
    showGuides: true,
    showVanishingPoints: true,
    showHorizon: true,
    feedbackDetail: 'standard',
  },
  advanced: {
    label: 'Advanced',
    description: 'Strict grading, critical feedback',
    showGuides: true,
    showVanishingPoints: true, // Guides are now independent
    showHorizon: true,
    feedbackDetail: 'concise',
  },
} as const;

// Onboarding functions
const ONBOARDING_KEY = 'art-tutor-onboarded';

export function isOnboardingCompleted(): boolean {
  try {
    if (localStorage.getItem(ONBOARDING_KEY) === 'true') return true;
    // Existing users (before this feature) skip onboarding
    if (localStorage.getItem(STORAGE_KEY)) return true;
  } catch (e) {
    console.error('Failed to check onboarding status:', e);
  }
  return false;
}

export function setOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, 'true');
  } catch (e) {
    console.error('Failed to set onboarding status:', e);
  }
}
