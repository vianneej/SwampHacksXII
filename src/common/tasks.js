// Place-visit task ids match scene names; order-<npc> / chat-<npc> tasks complete when you pick that dialogue option with the NPC.
export const TASKS = [
  { id: 'coins', label: 'Collect 5 coins', goal: 5, reward: 50 },
  { id: 'library', label: 'Visit the library', goal: 1, reward: 20 },
  { id: 'shop', label: 'Visit the flower shop', goal: 1, reward: 20 },
  { id: 'park', label: 'Visit the park', goal: 1, reward: 20 },
  { id: 'order-remo', label: 'Talk to Remo about his coffee order', goal: 1, reward: 30 },
  { id: 'chat-shelby', label: 'Chat with Shelby', goal: 1, reward: 20 },
  { id: 'chat-frank', label: 'Chat with Frank', goal: 1, reward: 20 },
  { id: 'order-carl', label: 'Talk to Carl about his coffee order', goal: 1, reward: 30 },
  { id: 'chat-jennifer', label: 'Chat with Jennifer', goal: 1, reward: 20 },
  { id: 'order-stephen', label: 'Talk to Stephen about his coffee order', goal: 1, reward: 30 },
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
