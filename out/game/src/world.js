/**
 * world.js — Open-world simulation engine for Vice Point 3D
 */

import { WORLD, PLAYER, CAR, TRAFFIC, PEDS, POLICE, HELI, WANTED, PALETTE } from './config.js';

export const EVENT_OVER = 1;
export const EVENT_BUSTED = 2;
export const EVENT_MISSION = 4;
export const EVENT_WANTED = 8;

const MISSIONS = [
  {
    id: 'hotwire',
    title: 'Hotwire',
    brief: 'Mara Voss needs wheels. Steal any civilian car and bring it to the plaza garage.',
    target: { kind: 'place', x: 1280, y: 960, label: 'Plaza Garage' },
    reward: 500,
    timeLimit: 90
  },
  {
    id: 'courier',
    title: 'Courier',
    brief: 'Deliver the package to the port warehouse before time runs out.',
    target: { kind: 'place', x: 2240, y: 1200, label: 'Port Warehouse' },
    reward: 1000,
    timeLimit: 75
  },
  {
    id: 'getaway',
    title: 'Getaway',
    brief: 'Provoke the cops to 3 stars heat, then survive for 25 seconds.',
    target: { kind: 'evade', x: 1280, y: 960, label: 'Evade Cops' },
    reward: 1500,
    timeLimit: 60
  },
  {
    id: 'collection',
    title: 'Collection',
    brief: 'Collect 3 hidden cash drops scattered across the downtown district.',
    target: { kind: 'collect', x: 960, y: 640, label: 'Cash Drop' },
    reward: 2000,
    timeLimit: 120
  },
  {
    id: 'big_score',
    title: 'The Big Score',
    brief: 'Hit the downtown bank marker, then escape to the north safehouse with 3+ stars.',
    target: { kind: 'place', x: 960, y: 400, label: 'Downtown Bank' },
    reward: 3500,
    timeLimit: 100
  },
  {
    id: 'air_support',
    title: 'Air Support',
    brief: 'With a chopper overhead, duck into the multi-level parking garage, then stay clean 15s.',
    target: { kind: 'place', x: 1600, y: 800, label: 'Parking Garage' },
    reward: 5000,
    timeLimit: 90
  },
  {
    id: 'kingpin',
    title: 'Kingpin',
    brief: 'Pick up Mara Voss at the plaza and drive her safely to the coastal mansion.',
    target: { kind: 'pickup', x: 1280, y: 960, label: 'Mara Voss' },
    reward: 10000,
    timeLimit: 120
  }
];

export function createWorld(random) {
  let state = null;
  let nextCarId = 1;
  let nextPedId = 1;

  function reset() {
    state = {
      time: 0,
      score: 0,
      money: 1200,
      health: PLAYER.health,
      wanted: 0,
      wantedHeat: 0,
      shops: [
        { kind: "paint", x: 1280, y: 960, label: "Spray & Go", lastUsed: 0 },
        { kind: "safehouse", x: 320, y: 320, label: "Safehouse", lastUsed: 0, lastMsg: 0 },
        { kind: "garage", x: 2240, y: 1200, label: "Garage", lastUsed: 0 }
      ],
      cashDrops: [],
      player: {
        x: 1280,
        y: 1100,
        angle: 0,
        speed: 0,
        onFoot: true,
        carId: null
      },
      cars: [],
      peds: [],
      police: [],
      heli: {
        active: false,
        x: 1280,
        y: 1100,
        angle: 0,
        alt: HELI.altitude
      },
      buildings: [],
      roads: { vertical: [], horizontal: [] },
      parks: [],
      beach: { y: 1680 },
      water: { y: 1800 },
      mission: {
        index: 0,
        stage: 0, // 0: go to target / do task, 1: escape / second phase
        target: { ...MISSIONS[0].target },
        timer: MISSIONS[0].timeLimit,
        text: MISSIONS[0].brief
      },
      camera: { x: 1280, y: 1100, shake: 0 },
      message: 'Welcome to Vice Point. Phone call from Mara Voss incoming...',
      messageTimer: 5,
      busted: false,
      over: false,
      win: false
    };

    generateCity(random);
    spawnInitialEntities(random);
  }

  function generateCity(rng) {
    const vRoads = [];
    for (let x = 320; x < WORLD.width - 200; x += 320) {
      vRoads.push(x);
    }
    const hRoads = [];
    for (let y = 280; y < WORLD.height - 300; y += 280) {
      hRoads.push(y);
    }

    state.roads.vertical = vRoads;
    state.roads.horizontal = hRoads;

    const roadWidth = 64;
    const sidewalkWidth = 14;

    // Generate buildings between road grid
    for (let i = 0; i < vRoads.length - 1; i++) {
      for (let j = 0; j < hRoads.length - 1; j++) {
        const x1 = vRoads[i] + roadWidth / 2 + sidewalkWidth;
        const x2 = vRoads[i + 1] - roadWidth / 2 - sidewalkWidth;
        const y1 = hRoads[j] + roadWidth / 2 + sidewalkWidth;
        const y2 = hRoads[j + 1] - roadWidth / 2 - sidewalkWidth;

        const bw = x2 - x1;
        const bh = y2 - y1;

        if (bw > 80 && bh > 80) {
          // Park block in center-left
          if (i === 1 && j === 1) {
            state.parks.push({ x: x1, y: y1, w: bw, h: bh });
          } else {
            // Split block into 1-4 buildings
            const cols = rng() > 0.5 ? 2 : 1;
            const rows = rng() > 0.5 ? 2 : 1;
            const cw = bw / cols;
            const ch = bh / rows;

            for (let r = 0; r < rows; r++) {
              for (let c = 0; c < cols; c++) {
                const bldgX = x1 + c * cw + 6;
                const bldgY = y1 + r * ch + 6;
                const bldgW = cw - 12;
                const bldgH = ch - 12;
                const height = 40 + Math.floor(rng() * 180);
                const colorPalette = i === vRoads.length - 2 ? PALETTE.building[7] : PALETTE.building[Math.floor(rng() * PALETTE.building.length)];

                state.buildings.push({
                  x: bldgX + bldgW / 2,
                  y: bldgY + bldgH / 2,
                  w: bldgW,
                  h: bldgH,
                  height,
                  color: colorPalette,
                  roof: rng() > 0.7 ? 'flat' : 'slant'
                });
              }
            }
          }
        }
      }
    }
  }

  function spawnInitialEntities(rng) {
    // Spawn parked cars near plaza (1280, 1100)
    const parkedCoords = [
      { x: 1240, y: 1040, angle: 0 },
      { x: 1320, y: 1060, angle: Math.PI / 2 },
      { x: 1200, y: 1080, angle: Math.PI }
    ];

    for (const p of parkedCoords) {
      state.cars.push({
        id: nextCarId++,
        x: p.x,
        y: p.y,
        angle: p.angle,
        speed: 0,
        color: PALETTE.trafficCar[Math.floor(rng() * PALETTE.trafficCar.length)],
        isPolice: false,
        stolen: false,
        driver: false
      });
    }

    // Spawn traffic cars
    for (let i = 0; i < TRAFFIC.count; i++) {
      const vRoad = state.roads.vertical[Math.floor(rng() * state.roads.vertical.length)];
      const hRoad = state.roads.horizontal[Math.floor(rng() * state.roads.horizontal.length)];
      const horizontal = rng() > 0.5;

      state.cars.push({
        id: nextCarId++,
        x: horizontal ? vRoad + (rng() * 400 - 200) : vRoad,
        y: horizontal ? hRoad : hRoad + (rng() * 400 - 200),
        angle: horizontal ? (rng() > 0.5 ? 0 : Math.PI) : (rng() > 0.5 ? Math.PI / 2 : -Math.PI / 2),
        speed: TRAFFIC.speedMin + rng() * (TRAFFIC.speedMax - TRAFFIC.speedMin),
        color: PALETTE.trafficCar[Math.floor(rng() * PALETTE.trafficCar.length)],
        isPolice: false,
        stolen: false,
        driver: true
      });
    }

    // Spawn pedestrians
    for (let i = 0; i < PEDS.count; i++) {
      const vRoad = state.roads.vertical[Math.floor(rng() * state.roads.vertical.length)];
      const hRoad = state.roads.horizontal[Math.floor(rng() * state.roads.horizontal.length)];
      state.peds.push({
        id: nextPedId++,
        x: vRoad + 45 + rng() * 30,
        y: hRoad + rng() * 200,
        angle: rng() * Math.PI * 2,
        speed: PEDS.speedMin + rng() * (PEDS.speedMax - PEDS.speedMin),
        color: PALETTE.ped[Math.floor(rng() * PALETTE.ped.length)],
        flee: false
      });
    }
  }

  function step(dt, input, attract = false) {
    if (state.busted || state.over || state.win) return 0;

    state.time += dt;
    if (state.messageTimer > 0) {
      state.messageTimer -= dt;
    }

    let events = 0;

    // Attract mode or normal gameplay
    if (attract) {
      // Slow camera pan and traffic movement
      state.camera.x += 30 * dt;
      if (state.camera.x > WORLD.width - 400) state.camera.x = 400;
      state.camera.y = 960;
      updateTraffic(dt);
      updatePeds(dt);
      return 0;
    }

    // Player controls & physics
    const pl = state.player;
    if (pl.onFoot) {
      // On foot movement
      let dx = input.mx;
      let dy = input.my;
      let len = Math.hypot(dx, dy);
      if (len > 0) {
        dx /= len; dy /= len;
        pl.angle = Math.atan2(dy, dx);
        let moveDist = PLAYER.walkSpeed * dt;
        let nx = pl.x + dx * moveDist;
        let ny = pl.y + dy * moveDist;

        // Building collision
        if (!checkBuildingCollision(nx, ny, PLAYER.radius)) {
          pl.x = nx;
          pl.y = ny;
        }
      }

      // Check enter car / steal
      if (input.enter) {
        let nearestCar = null;
        let minDist = 46;
        for (const car of state.cars) {
          let dist = Math.hypot(car.x - pl.x, car.y - pl.y);
          if (dist < minDist) {
            minDist = dist;
            nearestCar = car;
          }
        }
        if (nearestCar && !nearestCar.isPolice) {
          pl.onFoot = false;
          pl.carId = nearestCar.id;
          nearestCar.stolen = true;
          nearestCar.driver = true;
          addWantedHeat(1);
          showMessage('Car stolen! Evade the cops or complete the mission.');
          events |= EVENT_WANTED;
        }
      }

      // Combat punch
      if (input.action) {
        let hitTarget = null;
        let minHitDist = 34;
        for (const ped of state.peds) {
          let dist = Math.hypot(ped.x - pl.x, ped.y - pl.y);
          if (dist < minHitDist) {
            minHitDist = dist;
            hitTarget = ped;
          }
        }
        if (hitTarget) {
          state.peds = state.peds.filter(p => p.id !== hitTarget.id);
          addWantedHeat(0.5);
          showMessage('Punch landed!');
        }
      }

    } else {
      // In car
      let car = state.cars.find(c => c.id === pl.carId);
      if (!car) {
        pl.onFoot = true;
        pl.carId = null;
      } else {
        // Steering
        if (input.mx !== 0) {
          let maxSpd = (car.tuned ? CAR.maxSpeed * 1.25 : CAR.maxSpeed);
         car.angle += input.mx * CAR.turnRate * dt * (Math.abs(car.speed) / maxSpd + 0.3);
        }

        // Throttle & Brake
        if (input.my > 0) {
          car.speed += CAR.accel * dt * input.my;
        } else if (input.my < 0) {
          if (car.speed > 0) {
            car.speed -= CAR.brake * dt * Math.abs(input.my);
          } else {
            car.speed -= CAR.reverseAccel * dt * Math.abs(input.my);
          }
        } else {
          // Natural drag
          car.speed *= 0.98;
          if (Math.abs(car.speed) < 2) car.speed = 0;
        }

        // Handbrake
        if (input.handbrake) {
          car.speed *= 0.92;
        }

        // Clamp speed
        let maxSpd = (car.tuned ? CAR.maxSpeed * 1.25 : CAR.maxSpeed);
         car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpd, car.speed));

        // Move car
        let cdx = Math.cos(car.angle) * car.speed * dt;
        let cdy = Math.sin(car.angle) * car.speed * dt;
        let nx = car.x + cdx;
        let ny = car.y + cdy;

        if (checkBuildingCollision(nx, ny, CAR.length / 2)) {
          car.speed *= -0.3; // bounce / crash
          state.camera.shake = 0.3;
          if (Math.abs(car.speed) > 200) {
            state.health -= 5;
            if (state.health <= 0) {
              state.over = true;
              events |= EVENT_OVER;
            }
          }
        } else {
          car.x = nx;
          car.y = ny;
        }

        pl.x = car.x;
        pl.y = car.y;
        pl.angle = car.angle;
        pl.speed = car.speed;

        // Exit car
        if (input.enter) {
          pl.onFoot = true;
          pl.carId = null;
          pl.x = car.x + Math.sin(car.angle) * 35;
          pl.y = car.y - Math.cos(car.angle) * 35;
          car.speed = 0;
        }
      }
    }

    // Update traffic, pedestrians, police, helicopter, wanted system, missions
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateHeli(dt);
    updateWantedSystem(dt);
    updateMissions();
    
    // Shop logic
    if (!state.over && !state.win && !state.busted) {
      const paintShop = state.shops.find(s => s.kind === "paint");
      if (paintShop && !state.player.onFoot) {
        const car = state.cars.find(c => c.id === state.player.carId);
        if (car && Math.hypot(state.player.x - paintShop.x, state.player.y - paintShop.y) < 50) {
          if (state.money >= 200 && (state.time - paintShop.lastUsed >= 10)) {
            paintShop.lastUsed = state.time;
            state.money -= 200;
            car.color = PALETTE.trafficCar[Math.floor(Math.random() * PALETTE.trafficCar.length)];
            state.health = 100;
            showMessage("Fresh paint + full repair — $200");
          }
        }
      }

      const garageShop = state.shops.find(s => s.kind === "garage");
      if (garageShop && !state.player.onFoot) {
        const car = state.cars.find(c => c.id === state.player.carId);
        if (car && Math.hypot(state.player.x - garageShop.x, state.player.y - garageShop.y) < 50) {
          if (state.time - garageShop.lastUsed >= 10) {
            garageShop.lastUsed = state.time;
            car.tuned = true;
            car.color = "#ffd166";
            showMessage("Garage tune-up — sports spec!");
          }
        }
      }

      const safehouse = state.shops.find(s => s.kind === "safehouse");
      if (safehouse && Math.hypot(state.player.x - safehouse.x, state.player.y - safehouse.y) < 60) {
        state.wantedHeat = Math.max(0, state.wantedHeat - WANTED.decayRate * 2 * dt);
        if (state.time - safehouse.lastMsg >= 10) {
          safehouse.lastMsg = state.time;
          showMessage("Safehouse — heat dropping fast");
        }
      }
    }

    // Camera follow
    state.camera.x += (pl.x - state.camera.x) * 5 * dt;
    state.camera.y += (pl.y - state.camera.y) * 5 * dt;
    if (state.camera.shake > 0) state.camera.shake -= dt;

    return events;
  }

  function checkBuildingCollision(x, y, radius) {
    if (x < 60 || x > WORLD.width - 60 || y < 60 || y > WORLD.height - 60) return true;
    if (y > state.water.y) return true; // Water boundary

    for (const b of state.buildings) {
      let bx = Math.max(b.x - b.w / 2, Math.min(x, b.x + b.w / 2));
      let by = Math.max(b.y - b.h / 2, Math.min(y, b.y + b.h / 2));
      let dist = Math.hypot(x - bx, y - by);
      if (dist < radius) return true;
    }
    return false;
  }

  function updateTraffic(dt) {
    for (const car of state.cars) {
      if (!car.driver) continue;
      // Simple grid following AI
      let cdx = Math.cos(car.angle) * car.speed * dt;
      let cdy = Math.sin(car.angle) * car.speed * dt;
      car.x += cdx;
      car.y += cdy;

      // Wrap around or turn at intersections
      if (car.x < 0 || car.x > WORLD.width || car.y < 0 || car.y > WORLD.height) {
        car.x = state.roads.vertical[Math.floor(Math.random() * state.roads.vertical.length)];
        car.y = state.roads.horizontal[Math.floor(Math.random() * state.roads.horizontal.length)];
        car.angle = Math.random() > 0.5 ? 0 : Math.PI / 2;
      }
    }
  }

  function updatePeds(dt) {
    for (const ped of state.peds) {
      let distToPlayer = Math.hypot(state.player.x - ped.x, state.player.y - ped.y);
      if (distToPlayer < 140) {
        ped.flee = true;
        let angleToPlayer = Math.atan2(ped.y - state.player.y, ped.x - state.player.x);
        ped.angle = angleToPlayer;
        ped.x += Math.cos(ped.angle) * ped.speed * 1.5 * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * 1.5 * dt;
      } else {
        ped.flee = false;
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        if (Math.random() < 0.02) {
          ped.angle += (Math.random() - 0.5) * Math.PI;
        }
      }
    }
  }

  function updatePolice(dt) {
    if (state.wanted <= 0) {
      // Remove police cars if wanted is 0
      state.cars = state.cars.filter(c => !c.isPolice);
      state.police = [];
      return;
    }

    // Spawn police if needed
    while (state.police.length < state.wanted) {
      let spawnAngle = Math.random() * Math.PI * 2;
      let px = state.player.x + Math.cos(spawnAngle) * POLICE.spawnDistance;
      let py = state.player.y + Math.sin(spawnAngle) * POLICE.spawnDistance;

      let pCar = {
        id: nextCarId++,
        x: px,
        y: py,
        angle: Math.random() * Math.PI * 2,
        speed: POLICE.chaseSpeed,
        color: PALETTE.police,
        isPolice: true,
        stolen: false,
        driver: true
      };
      state.cars.push(pCar);
      state.police.push({ carId: pCar.id });
    }

    // Chase player and check bust condition
    for (const pRef of state.police) {
      let pCar = state.cars.find(c => c.id === pRef.carId);
      if (!pCar) continue;

      let angleToPl = Math.atan2(state.player.y - pCar.y, state.player.x - pCar.x);
      pCar.angle = angleToPl;
      pCar.x += Math.cos(pCar.angle) * pCar.speed * dt;
      pCar.y += Math.sin(pCar.angle) * pCar.speed * dt;

      let dist = Math.hypot(state.player.x - pCar.x, state.player.y - pCar.y);
      if (state.player.onFoot && dist < 40) {
        // Busted!
        state.busted = true;
        state.money = Math.floor(state.money * 0.7);
        state.wanted = 0;
        state.wantedHeat = 0;
        state.player.x = 1280;
        state.player.y = 1100;
        state.player.onFoot = true;
        state.busted = false; // reset flag after respawn penalty
        showMessage('Busted! Cops confiscated 30% of your cash.');
      }
    }
  }

  function updateHeli(dt) {
    if (state.wanted >= 3) {
      state.heli.active = true;
      state.heli.x += (state.player.x - state.heli.x) * 2 * dt;
      state.heli.y += (state.player.y - state.heli.y) * 2 * dt;
      state.heli.angle += 2 * dt;
    } else {
      state.heli.active = false;
    }
  }

  function updateWantedSystem(dt) {
    if (state.wantedHeat > 0) {
      state.wantedHeat -= WANTED.decayRate * dt;
      if (state.wantedHeat < 0) state.wantedHeat = 0;
    }
    state.wanted = Math.min(WANTED.max, Math.floor(state.wantedHeat));
  }

  function addWantedHeat(amount) {
    state.wantedHeat = Math.min(WANTED.max, state.wantedHeat + amount);
    state.wanted = Math.min(WANTED.max, Math.floor(state.wantedHeat));
  }

  function updateMissions() {
    if (state.mission.index === 3) {
      if (!state.cashDrops || state.cashDrops.length === 0) {
        state.cashDrops = [
          { x: 960, y: 640, taken: false },
          { x: 1280, y: 640, taken: false },
          { x: 1600, y: 640, taken: false }
        ];
      }
      for (const drop of state.cashDrops) {
        if (!drop.taken && Math.hypot(state.player.x - drop.x, state.player.y - drop.y) < 30) {
          drop.taken = true;
          state.money += 250;
          state.score += 250;
          showMessage("Cash collected!");
        }
      }
      if (state.cashDrops.every(d => d.taken)) {
        const mDef = MISSIONS[3];
        state.money += mDef.reward;
        state.score += mDef.reward;
        showMessage(`Mission Complete: ${mDef.title}! +${mDef.reward}`);
        state.mission.index++;
        if (state.mission.index < MISSIONS.length) {
          const nextM = MISSIONS[state.mission.index];
          state.mission.target = { ...nextM.target };
          state.mission.timer = nextM.timeLimit;
          state.mission.text = nextM.brief;
        } else {
          state.win = true;
        }
      }
      return;
    }
    if (state.mission.index >= MISSIONS.length) {
      state.win = true;
      return;
    }

    const mDef = MISSIONS[state.mission.index];
    state.mission.timer -= 1 / 60;

    if (state.mission.timer <= 0) {
      // Time expired — restart mission
      state.mission.timer = mDef.timeLimit;
      showMessage('Too slow — Mara gives you another shot.');
      return;
    }

    let distToTarget = Math.hypot(state.player.x - state.mission.target.x, state.player.y - state.mission.target.y);
    if (distToTarget < 60) {
      // Mission complete!
      state.money += mDef.reward;
      state.score += mDef.reward;
      showMessage(`Mission Complete: ${mDef.title}! +$${mDef.reward}`);
      state.mission.index++;

      if (state.mission.index < MISSIONS.length) {
        const nextM = MISSIONS[state.mission.index];
        state.mission.target = { ...nextM.target };
        state.mission.timer = nextM.timeLimit;
        state.mission.text = nextM.brief;
      } else {
        state.win = true;
      }
    }
  }

  function showMessage(msg) {
    state.message = msg;
    state.messageTimer = 4;
  }

  reset();

  return {
    reset,
    step,
    get state() { return state; }
  };
}
