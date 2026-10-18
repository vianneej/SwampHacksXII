import { NPC_DEFINITIONS, NPC_PHASES } from './npc-schedule.js';
import { isBlocked } from '../building-generator.js';

const NPC_SPEED = 105;
const ARRIVAL_DISTANCE = 1;
const NAVIGATION_STEP = 12;
const MAX_MOVEMENT_STEP = 4;
const DIRECTION_TIE_TOLERANCE = 0.5;
const CAFE_WANDER_BOUNDS = { minX: 70, maxX: 870, minY: 260, maxY: 620 };
// Match the player's feet box; sprite bounds remain reserved for NPC spacing.
const NPC_FEET_HALF_WIDTH = 12;
const NPC_FEET_HEIGHT = 8;

export function getNpcPhase(gameMinutes) {
  if (gameMinutes >= 20 * 60 && gameMinutes < 24 * 60) return NPC_PHASES.LIBRARY;
  if (gameMinutes >= 6 * 60 && gameMinutes < 20 * 60) return NPC_PHASES.FLOWER_SHOP;
  return NPC_PHASES.OVERNIGHT;
}

export function createNpcManager(spriteFrames, gameMinutes, areas, gameDay = 1) {
  const npcs = NPC_DEFINITIONS.map((definition) => {
    const frames = spriteFrames[definition.id];
    if (!frames) throw new Error(`Missing sprite frames for NPC "${definition.id}".`);
    for (const direction of ['down', 'left', 'right', 'up']) {
      if (!frames[direction] || frames[direction].length !== 3 || frames[direction].some((frame) => !frame)) {
        throw new Error(`NPC "${definition.id}" is missing one or more ${direction} animation frames.`);
      }
    }

    const currentEventIndex = definition.schedule.findLastIndex((event) => event.at < gameMinutes);
    const settled = definition.schedule[currentEventIndex]?.settled;
    const activity = settled?.activity || { type: 'stand', facing: 'down' };
    const position = settled?.area ? settled : definition.initialPosition;
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
      walkAnimationTime: 0,
      present: settled?.present || false,
      schedule: definition.schedule,
      nextEventIndex: currentEventIndex + 1,
      route: [],
      routeIndex: 0,
      patrolIndex: 0,
      activity,
      mode: settled?.present ? activity.type : 'stand',
      path: [],
      pathTarget: null,
      pathRetry: 0,
      exitsWhenRouteEnds: false,
      wanderTarget: null,
      wanderPauseRemaining: 0,
      randomState: definition.id.split('').reduce((seed, character) => (
        Math.imul(seed ^ character.charCodeAt(0), 16777619) >>> 0
      ), 2166136261) || 1,
    };
  });

  return { day: gameDay, phase: getNpcPhase(gameMinutes), npcs, areas };
}

export function updateNpcManager(manager, gameMinutes, deltaSeconds, gameDay = manager.day) {
  manager.phase = getNpcPhase(gameMinutes);
  if (gameDay !== manager.day) {
    manager.day = gameDay;
    for (const npc of manager.npcs) {
      npc.nextEventIndex = 0;
    }
  }

  for (const npc of manager.npcs) {
    while (npc.nextEventIndex < npc.schedule.length
      && npc.schedule[npc.nextEventIndex].at <= gameMinutes) {
      const event = npc.schedule[npc.nextEventIndex];
      if ((event.requiresArea && npc.area !== event.requiresArea)
        || (event.requiresPresence && !npc.present)) {
        npc.nextEventIndex++;
        continue;
      }
      if (event.spawn && !canOccupy(
        npc,
        event.spawn.x,
        event.spawn.y,
        event.spawn.area,
        manager.areas,
        manager.npcs,
      )) break;
      beginScheduleEvent(npc, event);
      npc.nextEventIndex++;
    }

    if (!npc.present) {
      npc.moving = false;
      continue;
    }
    if (npc.paused) {
      npc.moving = false;
      continue;
    }
    const previousX = npc.x;
    const previousY = npc.y;
    const previousArea = npc.area;

    moveNpc(npc, manager, deltaSeconds);

    const movedDistance = Math.hypot(
      npc.x - previousX,
      npc.y - previousY
    );

    // Changing areas is a teleport, so don't count it as walking.
    npc.moving =
      npc.area === previousArea &&
      movedDistance > 0.01;

    if (npc.moving) {
      npc.walkAnimationTime += deltaSeconds;
    }
  }
}

function beginScheduleEvent(npc, event) {
  if (event.spawn) {
    npc.area = event.spawn.area;
    npc.x = event.spawn.x;
    npc.y = event.spawn.y;
    npc.present = true;
  }
  npc.route = event.route;
  npc.routeIndex = 0;
  npc.activity = event.activity;
  npc.mode = 'route';
  npc.moving = false;
  npc.path = [];
  npc.pathTarget = null;
  npc.pathRetry = 0;
  npc.patrolIndex = 0;
  npc.wanderTarget = null;
  npc.wanderPauseRemaining = 0;
  npc.exitsWhenRouteEnds = event.exits;
  if (event.route.length === 0) finishRoute(npc);
}

function finishRoute(npc) {
  npc.moving = false;
  npc.path = [];
  npc.pathTarget = null;
  if (npc.exitsWhenRouteEnds) {
    npc.present = false;
    npc.mode = 'stand';
    return;
  }
  npc.mode = npc.activity.type;
  npc.facing = npc.activity.facing || npc.facing;
  npc.exitsWhenRouteEnds = false;
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

  if (npc.mode === 'wander') {
    wanderNpc(npc, manager, deltaSeconds);
    return;
  }

  const waypoint = npc.route[npc.routeIndex];
  if (!waypoint) {
    finishRoute(npc);
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

function wanderNpc(npc, manager, deltaSeconds) {
  if (npc.wanderPauseRemaining > 0) {
    npc.wanderPauseRemaining = Math.max(0, npc.wanderPauseRemaining - deltaSeconds);
    npc.moving = false;
    return;
  }

  if (!npc.wanderTarget) {
    npc.wanderTarget = chooseWanderTarget(npc, manager);
    if (!npc.wanderTarget) {
      npc.wanderPauseRemaining = 1;
      npc.moving = false;
      return;
    }
  }

  moveToTarget(npc, npc.wanderTarget, manager, deltaSeconds, () => {
    npc.wanderTarget = null;
    const { pauseMin = 1.5, pauseMax = 4 } = npc.activity;
    npc.wanderPauseRemaining = pauseMin + nextRandom(npc) * (pauseMax - pauseMin);
  });
}

function chooseWanderTarget(npc, manager) {
  const area = manager.areas.cafe;
  if (!area || npc.area !== 'cafe') return null;

  for (let attempt = 0; attempt < 32; attempt++) {
    const target = {
      area: 'cafe',
      x: CAFE_WANDER_BOUNDS.minX + nextRandom(npc) * (CAFE_WANDER_BOUNDS.maxX - CAFE_WANDER_BOUNDS.minX),
      y: CAFE_WANDER_BOUNDS.minY + nextRandom(npc) * (CAFE_WANDER_BOUNDS.maxY - CAFE_WANDER_BOUNDS.minY),
    };
    if (distance(npc, target) < 120
      || isBlocked(area, target.x, target.y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)
      || isNpcBlockedAt(npc, target.x, target.y, manager.npcs)) continue;
    return target;
  }
  return null;
}

function nextRandom(npc) {
  let value = (npc.randomState + 0x6d2b79f5) >>> 0;
  npc.randomState = value;
  value = Math.imul(value ^ (value >>> 15), value | 1);
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
  npc.randomState = value >>> 0;
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
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
  const startX = npc.x;
  const startY = npc.y;
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

  let remaining = Math.min(NPC_SPEED * deltaSeconds, distance);
  while (remaining > 0) {
    const step = Math.min(remaining, MAX_MOVEMENT_STEP);
    const nextX = npc.x + (dx / distance) * step;
    const nextY = npc.y + (dy / distance) * step;
    const blockedBy = canMove(npc, nextX, nextY, area, allNpcs);
    if (blockedBy) {
      setFacingFromMovement(npc, startX, startY);
      npc.moving = false;
      return blockedBy;
    }
    npc.x = nextX;
    npc.y = nextY;
    remaining -= step;
  }

  setFacingFromMovement(npc, startX, startY);
  npc.moving = true;
  if (Math.hypot(waypoint.x - npc.x, waypoint.y - npc.y) <= ARRIVAL_DISTANCE) {
    npc.x = waypoint.x;
    npc.y = waypoint.y;
    npc.moving = false;
    onArrival();
  }

  function setFacingFromMovement(npc, startX, startY) {
    const dx = npc.x - startX;
    const dy = npc.y - startY;
    if (Math.hypot(dx, dy) > 0.01) npc.facing = getDominantDirection(dx, dy);
  }
  return null;
}

function canOccupy(npc, x, y, areaName, areas, allNpcs) {
  const area = areas[areaName];
  if (!area || isBlocked(area, x, y, NPC_FEET_HALF_WIDTH, NPC_FEET_HEIGHT)) return false;
  const candidate = getBounds(npc, x, y);
  return allNpcs.every((other) => {
    if (other === npc || !other.present || other.area !== areaName) return true;
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
      && other.present
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
  return simplifyPath(npc, path, area, allNpcs);
}

function getDominantDirection(dx, dy) {
  if (Math.abs(dx) + DIRECTION_TIE_TOLERANCE >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function simplifyPath(npc, path, area, allNpcs) {
  const simplified = [];
  let start = { x: npc.x, y: npc.y };
  let index = 0;
  while (index < path.length) {
    let furthest = index;
    for (let candidate = index + 1; candidate < path.length; candidate++) {
      if (isClearSegment(npc, start, path[candidate], area, allNpcs)) furthest = candidate;
      else break;
    }
    start = path[furthest];
    simplified.push(start);
    index = furthest + 1;
  }
  return simplified;
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
    && other.present
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
