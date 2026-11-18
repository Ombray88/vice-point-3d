import { STEP, POLICE } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY, SCREEN_WIN } from './render.js';

function norm(dx, dy) {
  const len = Math.hypot(dx, dy);
  return len > 0.001 ? { x: dx / len, y: dy / len } : { x: 0, y: 0 };
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

function pilot(state, evade = false) {
  const p = state.player;
  if (p.onFoot) {
    let nearestCar = null;
    let minDist = Infinity;
    for (const c of state.cars) {
      if (c.isPolice) continue;
      if (Math.abs(c.speed) < 10) {
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < minDist) {
          minDist = d;
          nearestCar = c;
        }
      }
    }
    if (!nearestCar) {
      minDist = Infinity;
      for (const c of state.cars) {
        if (c.isPolice) continue;
        const d = Math.hypot(c.x - p.x, c.y - p.y);
        if (d < minDist) {
          minDist = d;
          nearestCar = c;
        }
      }
    }
    if (!nearestCar) return { mx: 0, my: 0, enter: false, action: false, handbrake: false };
    const dx = nearestCar.x - p.x;
    const dy = nearestCar.y - p.y;
    const dir = norm(dx, dy);
    const enter = minDist <= 40;
    return { mx: dir.x, my: dir.y, enter, action: false, handbrake: false };
  } else {
    // In a car
    const car = state.cars.find(c => c.id === p.carId);
    if (!car) return { mx: 0, my: 0, enter: false, action: false, handbrake: false };

    let target = state.mission.target;
    if (evade) {
      let nearestCop = null;
      let minCopDist = Infinity;
      for (const copId of state.police) {
        const cop = state.cars.find(c => c.id === copId);
        if (cop) {
          const d = Math.hypot(cop.x - car.x, cop.y - car.y);
          if (d < minCopDist) {
            minCopDist = d;
            nearestCop = cop;
          }
        }
      }
      if (nearestCop && minCopDist < 140) {
        // Steer away from cop
        const dx = car.x - nearestCop.x;
        const dy = car.y - nearestCop.y;
        const desired = Math.atan2(dy, dx);
        const diff = normalizeAngle(desired - car.angle);
        const mx = clamp(diff * 2, -1, 1);
        return { mx, my: 1, enter: false, action: false, handbrake: false };
      }
    }

    if (!target) {
      return { mx: 0, my: 1, enter: false, action: false, handbrake: false };
    }

    const dx = target.x - car.x;
    const dy = target.y - car.y;
    const desired = Math.atan2(dy, dx);
    const diff = normalizeAngle(desired - car.angle);
    const mx = clamp(diff * 2, -1, 1);
    return { mx, my: 1, enter: false, action: false, handbrake: false };
  }
}

export function stageShot(name, world) {
  world.reset();
  const dt = STEP;

  if (name === 'start') {
    for (let t = 0; t < 5; t += dt) {
      world.step(dt, { mx: 0, my: 0, enter: false, action: false, handbrake: false }, true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }

  if (name === 'play') {
    // Walk to car & enter
    let tWalk = 0;
    while (world.state.player.onFoot && tWalk < 20) {
      const input = pilot(world.state, false);
      world.step(dt, input, false);
      tWalk += dt;
    }
    // Drive toward mission target for 8s
    let tDrive = 0;
    while (tDrive < 8) {
      const input = pilot(world.state, false);
      world.step(dt, input, false);
      tDrive += dt;
    }
    // Spawn police & heli
    world.state.wantedHeat = 3;
    world.state.wanted = 3;
    const p = world.state.player;
    for (let i = 0; i < 3; i++) {
      const angle = i * 2.1 + 0.5;
      const px = p.x + Math.cos(angle) * 500;
      const py = p.y + Math.sin(angle) * 500;
      const cId = 'police_shot_' + i;
      world.state.cars.push({
        id: cId,
        x: px,
        y: py,
        angle: 0,
        speed: 0,
        color: '#e5534b',
        isPolice: true,
        stolen: false,
        driver: 'cop'
      });
      world.state.police.push({ carId: cId });
    }
    world.state.heli.active = true;
    world.state.heli.x = p.x;
    world.state.heli.y = p.y;
    world.state.heli.alt = 160;

    // Evade for 18s
    let tEvade = 0;
    while (tEvade < 18) {
      const input = pilot(world.state, true);
      world.step(dt, input, false);
      tEvade += dt;
    }
    return { screen: SCREEN_PLAY, best: world.state.money };
  }

  if (name === 'chase') {
    // Walk to car & enter
    let tWalk = 0;
    while (world.state.player.onFoot && tWalk < 20) {
      const input = pilot(world.state, false);
      world.step(dt, input, false);
      tWalk += dt;
    }
    // Drive toward mission target for 6s
    let tDrive = 0;
    while (tDrive < 6) {
      const input = pilot(world.state, false);
      world.step(dt, input, false);
      tDrive += dt;
    }
    // Spawn 4 police & heli (wanted 4)
    world.state.wantedHeat = 4;
    world.state.wanted = 4;
    const p = world.state.player;
    for (let i = 0; i < 4; i++) {
      const angle = i * 1.57 + 0.5;
      const px = p.x + Math.cos(angle) * 450;
      const py = p.y + Math.sin(angle) * 450;
      const cId = 'police_chase_' + i;
      world.state.cars.push({
        id: cId,
        x: px,
        y: py,
        angle: 0,
        speed: 0,
        color: '#e5534b',
        isPolice: true,
        stolen: false,
        driver: 'cop'
      });
      world.state.police.push({ carId: cId });
    }
    world.state.heli.active = true;
    world.state.heli.x = p.x;
    world.state.heli.y = p.y;
    world.state.heli.alt = 140;

    // Evade for 12s
    let tEvade = 0;
    while (tEvade < 12) {
      const input = pilot(world.state, true);
      world.step(dt, input, false);
      tEvade += dt;
    }
    return { screen: SCREEN_PLAY, best: world.state.money };
  }

  if (name === 'end') {
    world.state.win = true;
    world.state.money = 22500;
    world.state.mission.index = 7;
    return { screen: SCREEN_WIN, best: 22500 };
  }

  // Default / start fallback
  for (let t = 0; t < 5; t += dt) {
    world.step(dt, { mx: 0, my: 0, enter: false, action: false, handbrake: false }, true);
  }
  return { screen: SCREEN_TITLE, best: 0 };
}
