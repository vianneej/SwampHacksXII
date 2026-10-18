import { NPC_DEFINITIONS, NPC_PHASES, NPC_SCHEDULE } from './npc-schedule.js';
import { isBlocked } from '../building-generator.js';

const NPC_SPEED = 105;
const ARRIVAL_DISTANCE = 1;
const NAVIGATION_STEP = 12;
const MAX_MOVEMENT_STEP = 4;
// Match the player's feet box; sprite bounds remain reserved for NPC spacing.
const NPC_FEET_HALF_WIDTH = 12;
const NPC_FEET_HEIGHT = 8;

export function getNpcPhase(gameMinutes) {
  for (let index = NPC_SCHEDULE.length - 1; index >= 0; index--) {
    if (gameMinutes >= NPC_SCHEDULE[index].startsAt) return NPC_SCHEDULE[index].phase;
  }
  return NPC_PHASES.FLOWER_SHOP;
}

export function createNpcManager(spriteFrames, gameMinutes, areas) {
  const phase = getNpcPhase(gameMinutes);
  const initialPhase = gameMinutes === NPC_SCHEDULE[0].startsAt
    ? NPC_PHASES.OVERNIGHT
    : phase;
  const npcs = NPC_DEFINITIONS.map((definition) => {
    const frames = spriteFrames[definition.id];
    if (!frames) throw new Error(`Missing sprite frames for NPC "${definition.id}".`);
    for (const direction of ['down', 'left', 'right', 'up']) {
      if (!frames[direction] || frames[direction].length !== 3 || frames[direction].some((frame) => !frame)) {
        throw new Error(`NPC "${definition.id}" is missing one or more ${direction} animation frames.`);
      }
    }

    const position = definition.initialPositions[initialPhase];
    const activity = definition.activities[initialPhase];
    return {
      id: definition.id,
      name: definition.name,
      frames,
      displayHeight: definition.displayHeight,
      collisionWidth: definition.collisionWidth,
      collisionHeight: definition.collisionHeight,
      area: position.area,
      x: position.x,
      y: position.y,
      facing: activity.facing || 'down',
      moving: false,
      phase: initialPhase,
      route: [],
      routeIndex: 0,
      patrolIndex: activity.type === 'patrol' ? 1 : 0,
      activity,
      mode: activity.type,
      path: [],
      pathTarget: null,
      pathRetry: 0,
      delayRemaining: 0,
    };
  });

  return { phase: initialPhase, npcs, areas };
}

export function updateNpcManager(manager, gameMinutes, deltaSeconds) {
  const nextPhase = getNpcPhase(gameMinutes);
  if (nextPhase !== manager.phase) {
    manager.phase = nextPhase;
    for (const npc of manager.npcs) {
      npc.phase = nextPhase;
      npc.route = NPC_DEFINITIONS.find((definition) => definition.id === npc.id).routes[nextPhase];
      npc.routeIndex = 0;
      npc.activity = NPC_DEFINITIONS.find((definition) => definition.id === npc.id).activities[nextPhase];
      npc.mode = 'route';
      npc.moving = false;
      npc.path = [];
      npc.pathTarget = null;
      npc.pathRetry = 0;
      npc.delayRemaining = NPC_DEFINITIONS.find((definition) => definition.id === npc.id)
        .startDelays?.[nextPhase] || 0;
    }
  }

  for (const npc of manager.npcs) {
    if (npc.paused) {
      npc.moving = false;
      continue;
    }
    if (npc.delayRemaining > 0) {
      npc.delayRemaining = Math.max(0, npc.delayRemaining - deltaSeconds);
      npc.moving = false;
      if (npc.delayRemaining > 0) continue;
    }
    moveNpc(npc, manager, deltaSeconds);
  }
}

function moveNpc(npc, manager, deltaSeconds) {
  const { npcs: allNpcs, areas } = manager;
  if (npc.mode === 'stand') {
    npc.moving = false;
    return;
  }

  if (npc.mode === 'patrol') {
    const waypoints = npc.activity.waypoints;
    npc.patrolIndex %= waypoints.length;
    moveToTarget(npc, waypoints[npc.patrolIndex], manager, deltaSeconds, () => {
      npc.patrolIndex = (npc.patrolIndex + 1) % waypoints.length;
    });
    return;
  }

  const waypoint = npc.route[npc.routeIndex];
  if (!waypoint) {
    const activity = npc.activity;
    npc.mode = activity.type;
    npc.facing = activity.facing || npc.facing;
    npc.moving = false;
    if (activity.type === 'patrol') npc.patrolIndex = 1;
    return;
  }

  if (waypoint.area !== npc.area) {
    if (canOccupy(npc, waypoint.x, waypoint.y, waypoint.area, areas, allNpcs)) {
      npc.area = waypoint.area;
      npc.x = waypoint.x;
      npc.y = waypoint.y;
      npc.routeIndex++;
      npc.path = [];
      npc.pathTarget = null;
    }
    npc.moving = false;
    return;
  }

  moveToTarget(npc, waypoint, manager, deltaSeconds, () => {
    npc.routeIndex++;
  });
}

function moveToTarget(npc, target, manager, deltaSeconds, onArrival) {
  const area = manager.areas[npc.area];
  if (!samePoint(npc.pathTarget, target)) {
    npc.pathTarget = target;
    npc.path = findPath(npc, target, area, manager.npcs);
    npc.pathRetry = 0.25;
  } else if (!npc.path.length && distance(npc, target) > ARRIVAL_DISTANCE) {
    npc.pathRetry -= deltaSeconds;
    if (npc.pathRetry <= 0) {
      npc.path = findPath(npc, target, area, manager.npcs);
      npc.pathRetry = 0.25;
    }
  }
  if (distance(npc, target) <= ARRIVAL_DISTANCE) {
    npc.moving = false;
    npc.path = [];
    npc.pathTarget = null;
    onArrival();
    return;
  }
  if (!npc.path.length) {
    npc.moving = false;
    return;
  }

  const result = moveToward(npc, npc.path[0], area, manager.npcs, deltaSeconds, () => {
    if (npc.path.length) npc.path.shift();
    if (!npc.path.length) {
      if (distance(npc, target) <= ARRIVAL_DISTANCE) {
        onArrival();
      }
      npc.pathTarget = null;
    }
  });
  if (result) {
    npc.path = findPath(npc, target, area, manager.npcs);
    npc.pathRetry = 0.25;
  }
}

function moveToward(npc, waypoint, area, allNpcs, deltaSeconds, onArrival) {
  const dx = waypoint.x - npc.x;
  const dy = waypoint.y - npc.y;
  const distance = Math.hypot(dx, dy);
  if (distance <= ARRIVAL_DISTANCE) {
    const blockedBy = canMove(npc, waypoint.x, waypoint.y, area, allNpcs);
    if (blockedBy) {
      npc.moving = false;
      return blockedBy;
    }
    npc.x = waypoint.x;
    npc.y = waypoint.y;
    npc.moving = false;
    onArrival();
    return null;
  }

  npc.facing = Math.abs(dx) > Math.abs(dy)
    ? (dx < 0 ? 'left' : 'right')
    : (dy < 0 ? 'up' : 'down');
  let remaining = Math.min(NPC_SPEED * deltaSeconds, distance);
  while (remaining > 0) {
    const step = Math.min(remaining, MAX_MOVEMENT_STEP);
    const nextX = npc.x + (dx / distance) * step;
    const nextY = npc.y + (dy / distance) * step;
    const blockedBy = canMove(npc, nextX, nextY, area, allNpcs);
    if (blockedBy) {
      npc.moving = false;
      return blockedBy;
    }
    npc.x = nextX;
    npc.y = nextY;
    remaining -= step;
  }

  npc.moving = true;
  if (Math.hypot(waypoint.x - npc.x, waypoint.y - npc.y) <= ARRIVAL_DISTANCE) {
    npc.x = waypoint.x;
    npc.y = waypoint.y;
    npc.moving = false;
    onArrival();
  }
  return null;
}

function canOccupy(npc, x, y, areaName, areas, allNpcs) {
  const area = areas[areaName];
  if (!area || isBlocked(area, x, y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)) return false;
  const candidate = getBounds(npc, x, y);
  return allNpcs.every((other) => {
    if (other === npc || other.area !== areaName) return true;
    return !overlaps(candidate, getBounds(other, other.x, other.y));
  });
}

function canMove(npc, nextX, nextY, area, allNpcs) {
  const distance = Math.hypot(nextX - npc.x, nextY - npc.y);
  const steps = Math.ceil(distance);
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    const x = npc.x + (nextX - npc.x) * progress;
    const y = npc.y + (nextY - npc.y) * progress;
    if (isBlocked(area, x, y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)) return 'object';

    const candidate = getBounds(npc, x, y);
    const overlapsAnotherNpc = allNpcs.some((other) => (
      other !== npc
      && other.area === npc.area
      && overlaps(candidate, getBounds(other, other.x, other.y))
    ));
    if (overlapsAnotherNpc) return 'npc';
  }
  return null;
}

function findPath(npc, target, area, allNpcs) {
  if (isBlocked(area, target.x, target.y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)) return [];
  if (isNpcBlockedAt(npc, target.x, target.y, allNpcs)) return [];

  const start = { x: npc.x, y: npc.y };
  const startKey = pointKey(start);
  const open = [{ ...start, key: startKey, cost: 0, estimate: distance(start, target) }];
  const costs = new Map([[startKey, 0]]);
  const parents = new Map();
  const visited = new Set();
  const directions = [
    [1, 0], [-1, 0], [0, 1], [0, -1],
    [1, 1], [1, -1], [-1, 1], [-1, -1],
  ];
  let goalKey = null;

  while (open.length) {
    open.sort((a, b) => a.cost + a.estimate - b.cost - b.estimate);
    const current = open.shift();
    if (visited.has(current.key)) continue;
    visited.add(current.key);

    if (distance(current, target) <= NAVIGATION_STEP
      && isClearSegment(npc, current, target, area, allNpcs)) {
      goalKey = current.key;
      break;
    }

    for (const [dx, dy] of directions) {
      const next = {
        x: current.x + dx * NAVIGATION_STEP,
        y: current.y + dy * NAVIGATION_STEP,
      };
      const key = pointKey(next);
      if (visited.has(key)
        || isBlocked(area, next.x, next.y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)
        || !isClearSegment(npc, current, next, area, allNpcs)) continue;

      const cost = current.cost + (dx !== 0 && dy !== 0 ? NAVIGATION_STEP * Math.SQRT2 : NAVIGATION_STEP);
      if (cost >= (costs.get(key) ?? Infinity)) continue;
      costs.set(key, cost);
      parents.set(key, current.key);
      open.push({ ...next, key, cost, estimate: distance(next, target) });
    }
  }

  if (!goalKey) return [];
  const path = [];
  let key = goalKey;
  while (key !== startKey) {
    const [x, y] = key.split(',').map(Number);
    path.push({ x, y });
    key = parents.get(key);
    if (!key) return [];
  }
  path.reverse();
  if (distance(path.at(-1) || start, target) > ARRIVAL_DISTANCE) path.push(target);
  return path;
}

function pointKey(point) {
  return `${point.x},${point.y}`;
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}

function isClearSegment(npc, start, end, area, allNpcs) {
  const distanceBetween = distance(start, end);
  const steps = Math.ceil(distanceBetween);
  for (let step = 1; step <= steps; step++) {
    const progress = step / steps;
    const x = start.x + (end.x - start.x) * progress;
    const y = start.y + (end.y - start.y) * progress;
    if (isBlocked(area, x, y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)
      || isNpcBlockedAt(npc, x, y, allNpcs)) return false;
  }
  return true;
}

function isNpcBlockedAt(npc, x, y, allNpcs) {
  const candidate = getBounds(npc, x, y);
  return allNpcs.some((other) => (
    other !== npc
    && other.area === npc.area
    && overlaps(candidate, getBounds(other, other.x, other.y))
  ));
}

function samePoint(first, second) {
  return first === second || (first && second && first.area === second.area
    && first.x === second.x && first.y === second.y);
}

function getBounds(npc, x, y) {
  return {
    left: x - npc.collisionWidth / 2,
    right: x + npc.collisionWidth / 2,
    top: y - npc.collisionHeight,
    bottom: y,
  };
}

function overlaps(first, second) {
  return first.left < second.right
    && first.right > second.left
    && first.top < second.bottom
    && first.bottom > second.top;
}
