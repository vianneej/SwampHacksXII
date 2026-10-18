// Task ids for place visits match scene names, so entering a scene completes its task.
export const TASKS = [
  { id: 'coins', label: 'Collect 5 coins', goal: 5, reward: 50 },
  { id: 'library', label: 'Visit the library', goal: 1, reward: 20 },
  { id: 'shop', label: 'Visit the flower shop', goal: 1, reward: 20 },
  { id: 'park', label: 'Visit the park', goal: 1, reward: 20 },
];

export function emptyTaskProgress() {
  return Object.fromEntries(TASKS.map((task) => [task.id, 0]));
}

export function sanitizeTaskProgress(saved) {
  const progress = emptyTaskProgress();
  if (!saved || typeof saved !== 'object') return progress;
  for (const task of TASKS) {
    progress[task.id] = Math.min(task.goal, Math.max(0, saved[task.id] | 0));
  }
  return progress;
}
