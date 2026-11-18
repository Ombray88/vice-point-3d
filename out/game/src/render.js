/**
 * render.js — WebGL2 & 2D HUD Renderer for Vice Point 3D
 *
 * Exports:
 *   createRenderer(canvas)
 *   SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN
 */

import { createGL } from './gl.js';
import { PALETTE, WORLD, CAR, FONT } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_WIN = 'win';

export function createRenderer(canvas) {
  const gl = createGL(canvas);

  // Dynamic 2D overlay canvas for HUD & menus
  const overlay = document.createElement('canvas');
  overlay.width = 1280;
  overlay.height = 720;
  overlay.style.position = 'absolute';
  overlay.style.left = canvas.style.left || '0';
  overlay.style.top = canvas.style.top || '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  overlay.style.zIndex = '10';
  canvas.style.zIndex = '1';
  if (canvas.parentNode) {
    canvas.parentNode.style.position = 'relative';
    canvas.parentNode.appendChild(overlay);
  }
  const ctx = overlay.getContext('2d');

  // Mesh cache: key -> mesh
  const meshCache = new Map();

  function getBoxMesh(w, h, d, color) {
    const key = `box_${w}_${h}_${d}_${color}`;
    if (!meshCache.has(key)) {
      meshCache.set(key, gl.box(w, h, d, color));
    }
    return meshCache.get(key);
  }

  function getQuadMesh(w, d, color) {
    const key = `quad_${w}_${d}_${color}`;
    if (!meshCache.has(key)) {
      meshCache.set(key, gl.quad(w, d, color));
    }
    return meshCache.get(key);
  }

  function getCylinderMesh(rTop, rBottom, h, segs, color) {
    const key = `cyl_${rTop}_${rBottom}_${h}_${segs}_${color}`;
    if (!meshCache.has(key)) {
      meshCache.set(key, gl.cylinder(rTop, rBottom, h, segs, color));
    }
    return meshCache.get(key);
  }

  function getConeMesh(r, h, segs, color) {
    const key = `cone_${r}_${h}_${segs}_${color}`;
    if (!meshCache.has(key)) {
      meshCache.set(key, gl.cone(r, h, segs, color));
    }
    return meshCache.get(key);
  }

  // Camera state smoothing
  let camEye = { x: 0, y: 300, z: -500 };
  let camTarget = { x: 0, y: 0, z: 0 };
  let firstDraw = true;

  function draw(state, screen, best = 0) {
    const time = state.time || 0;
    const player = state.player || { x: WORLD.width / 2, y: WORLD.height / 2, angle: 0, speed: 0, onFoot: true };
    const pAngle = player.angle || 0;
    const fx = Math.cos(pAngle);
    const fz = Math.sin(pAngle);

    // Target camera position
    let targetEye, targetLook;
    if (screen === SCREEN_TITLE) {
      targetEye = {
        x: player.x - fx * 700,
        y: 420,
        z: player.y - fz * 700
      };
      targetLook = {
        x: player.x + fx * 300,
        y: 50,
        z: player.y + fz * 300
      };
    } else if (player.onFoot) {
      targetEye = {
        x: player.x - fx * 280 + 10,
        y: 220,
        z: (player.y - fz * 280) + 10
      };
      targetLook = {
        x: player.x + fx * 100,
        y: 20,
        z: player.y + fz * 100
      };
    } else {
      targetEye = {
        x: player.x - fx * 420 + 10,
        y: 320,
        z: (player.y - fz * 420) + 10
      };
      targetLook = {
        x: player.x + fx * 180,
        y: 30,
        z: player.y + fz * 180
      };
    }

    const dist = Math.hypot(targetEye.x - camEye.x, targetEye.y - camEye.y, targetEye.z - camEye.z);
    if (firstDraw || dist > 800) {
      camEye.x = targetEye.x;
      camEye.y = targetEye.y;
      camEye.z = targetEye.z;
      camTarget.x = targetLook.x;
      camTarget.y = targetLook.y;
      camTarget.z = targetLook.z;
      firstDraw = false;
    } else {
      // Smooth lerp camera
      const lerpRate = 0.1;
      camEye.x += (targetEye.x - camEye.x) * lerpRate;
      camEye.y += (targetEye.y - camEye.y) * lerpRate;
      camEye.z += (targetEye.z - camEye.z) * lerpRate;

      camTarget.x += (targetLook.x - camTarget.x) * lerpRate;
      camTarget.y += (targetLook.y - camTarget.y) * lerpRate;
      camTarget.z += (targetLook.z - camTarget.z) * lerpRate;
    }

    // 3D world coords: x, wy -> x, 0, y
    gl.setCamera(
      { x: camEye.x, y: camEye.y, z: camEye.z },
      { x: camTarget.x, y: camTarget.y, z: camTarget.z },
      { x: 0, y: 1, z: 0 },
      62 * Math.PI / 180
    );

    gl.begin(PALETTE.skyTop, PALETTE.skyBottom, PALETTE.fog);

    // 1. Ground & Sidewalks
    const groundMesh = getQuadMesh(WORLD.width, WORLD.height, PALETTE.sidewalk);
    gl.drawMesh(groundMesh, { x: WORLD.width / 2, y: 0, z: WORLD.height / 2, ry: 0 }, 0);

    // 2. Roads
    const roads = state.roads || { vertical: [], horizontal: [] };
    const roadWidth = 64;
    for (const rx of roads.vertical) {
      const roadMesh = getQuadMesh(roadWidth, WORLD.height, PALETTE.asphalt);
      gl.drawMesh(roadMesh, { x: rx, y: 2, z: WORLD.height / 2, ry: 0 }, 0);
      const lineMesh = getQuadMesh(4, WORLD.height, PALETTE.roadLine);
      gl.drawMesh(lineMesh, { x: rx, y: 3, z: WORLD.height / 2, ry: 0 }, 0.2);
    }
    for (const ry of roads.horizontal) {
      const roadMesh = getQuadMesh(WORLD.width, roadWidth, PALETTE.asphalt);
      gl.drawMesh(roadMesh, { x: WORLD.width / 2, y: 2, z: ry, ry: 0 }, 0);
      const lineMesh = getQuadMesh(WORLD.width, 4, PALETTE.roadLine);
      gl.drawMesh(lineMesh, { x: WORLD.width / 2, y: 3, z: ry, ry: 0 }, 0.2);
    }

    // 3. Parks
    if (state.parks) {
      for (const park of state.parks) {
        const pMesh = getQuadMesh(park.w, park.h, PALETTE.park);
        gl.drawMesh(pMesh, { x: park.x + park.w / 2, y: 4, z: park.y + park.h / 2, ry: 0 }, 0);
        // Trees
        for (let i = 0; i < 4; i++) {
          const tx = park.x + park.w * (0.2 + 0.2 * i);
          const tz = park.y + park.h * (0.3 + (i % 2) * 0.4);
          const trunk = getCylinderMesh(4, 5, 24, 6, '#4a3525');
          const leaves = getConeMesh(16, 28, 6, '#2d6a4f');
          gl.drawMesh(trunk, { x: tx, y: 12, z: tz, ry: 0 }, 0);
          gl.drawMesh(leaves, { x: tx, y: 34, z: tz, ry: 0 }, 0);
        }
      }
    }

    // 4. Beach & Water
    if (state.beach) {
      const bMesh = getQuadMesh(WORLD.width, 120, PALETTE.sand);
      gl.drawMesh(bMesh, { x: WORLD.width / 2, y: 2, z: state.beach.y, ry: 0 }, 0);
    }
    if (state.water) {
      const wMesh = getQuadMesh(WORLD.width, 300, PALETTE.water);
      gl.drawMesh(wMesh, { x: WORLD.width / 2, y: -2, z: state.water.y + 150, ry: 0 }, 0.15);
    }

    // 5. Buildings
    if (state.buildings) {
      let bIdx = 0;
      for (const b of state.buildings) {
        const col = PALETTE.building[bIdx % PALETTE.building.length];
        bIdx++;
        const h = b.height || 120;
        const bx = b.x + b.w / 2;
        const bz = b.y + b.h / 2;
        const bMesh = getBoxMesh(b.w, h, b.h, col);
        gl.drawMesh(bMesh, { x: bx, y: h / 2, z: bz, ry: 0 }, 0.05);

        // Roof
        const roofMesh = getBoxMesh(b.w, 4, b.h, PALETTE.windowsDark);
        gl.drawMesh(roofMesh, { x: bx, y: h + 2, z: bz, ry: 0 }, 0);

        // Antenna on tall buildings
        if (h > 180 && bIdx % 2 === 0) {
          const ant = getCylinderMesh(2, 2, 60, 4, '#8b93a3');
          gl.drawMesh(ant, { x: bx, y: h + 32, z: bz, ry: 0 }, 0.5);
        }
      }
    }

    // 6. Port (East edge)
    const portX = WORLD.width - 200;
    const craneBase = getBoxMesh(20, 160, 20, '#555555');
    const craneJib = getBoxMesh(100, 10, 15, '#c9a227');
    gl.drawMesh(craneBase, { x: portX, y: 80, z: 600, ry: 0 }, 0);
    gl.drawMesh(craneJib, { x: portX + 40, y: 155, z: 600, ry: 0 }, 0);
    gl.drawMesh(craneBase, { x: portX, y: 80, z: 1200, ry: 0 }, 0);
    gl.drawMesh(craneJib, { x: portX + 40, y: 155, z: 1200, ry: 0 }, 0);

    const container = getBoxMesh(40, 25, 20, '#e63946');
    gl.drawMesh(container, { x: portX - 80, y: 12.5, z: 700, ry: 0 }, 0);
    gl.drawMesh(container, { x: portX - 80, y: 37.5, z: 700, ry: 0 }, 0);

    // 7. Mission Marker
    if (state.mission && state.mission.target) {
      const tg = state.mission.target;
      const bob = Math.sin(time * 6) * 10;
      const diam1 = getConeMesh(18, 24, 6, '#ffd166');
      const diam2 = getConeMesh(18, 24, 6, '#ffd166');
      gl.drawMesh(diam1, { x: tg.x, y: 40 + bob, z: tg.y, ry: 0 }, 0.9);
      gl.drawMesh(diam2, { x: tg.x, y: 64 + bob, z: tg.y, ry: Math.PI }, 0.9);

      const ring = getCylinderMesh(30, 30, 4, 16, '#ffd166');
      gl.drawMesh(ring, { x: tg.x, y: 4, z: tg.y, ry: 0 }, 0.8);
    }

    // 7.5 Shops
    if (state.shops) {
      for (const shop of state.shops) {
        const color = shop.kind === "paint" ? "#4fc3f7" : (shop.kind === "safehouse" ? "#7ee787" : "#ffd166");
        const bob = Math.sin(time * 6 + shop.x) * 10;
        const d1 = getConeMesh(18, 24, 6, color);
        const d2 = getConeMesh(18, 24, 6, color);
        gl.drawMesh(d1, { x: shop.x, y: 40 + bob, z: shop.y, ry: 0 }, 0.8);
        gl.drawMesh(d2, { x: shop.x, y: 64 + bob, z: shop.y, ry: Math.PI }, 0.8);
        const ring = getCylinderMesh(30, 30, 4, 16, color);
        gl.drawMesh(ring, { x: shop.x, y: 4, z: shop.y, ry: 0 }, 0.7);
      }
    }

    // 8. Cash Drops
    if (state.cashDrops) {
      for (const drop of state.cashDrops) {
        if (!drop.taken) {
          const bob = Math.sin(time * 8 + drop.x) * 6;
          const cashBox = getBoxMesh(16, 16, 16, '#7ee787');
          gl.drawMesh(cashBox, { x: drop.x, y: 20 + bob, z: drop.y, ry: time * 2 }, 0.8);
        }
      }
    }

    // 9. Cars (Traffic & Player car)
    if (state.cars) {
      for (const car of state.cars) {
        const isPlayerCar = !player.onFoot && player.carId === car.id;
        const bodyColor = car.isPolice ? PALETTE.police : (car.color || PALETTE.trafficCar[0]);
        const carBody = getBoxMesh(CAR.length, 24, CAR.width, bodyColor);
        const carCabin = getBoxMesh(CAR.length * 0.5, 18, CAR.width * 0.8, '#1a2233');
        const wheel = getBoxMesh(10, 10, 6, '#111111');
        const headlight = getBoxMesh(4, 6, 4, '#fff5cc');

        const ry = -car.angle;
        const cx = car.x;
        const cz = car.y;

        gl.drawMesh(carBody, { x: cx, y: 16, z: cz, ry }, car.isPolice ? 0.3 : 0.1);
        gl.drawMesh(carCabin, { x: cx - 4, y: 34, z: cz, ry }, 0.2);

        // Wheels & lights offset
        const cosA = Math.cos(car.angle);
        const sinA = Math.sin(car.angle);
        // Front/back/left/right wheels simplified
        gl.drawMesh(wheel, { x: cx + 16 * cosA - 12 * sinA, y: 6, z: cz + 16 * sinA + 12 * cosA, ry }, 0);
        gl.drawMesh(wheel, { x: cx + 16 * cosA + 12 * sinA, y: 6, z: cz + 16 * sinA - 12 * cosA, ry }, 0);
        gl.drawMesh(wheel, { x: cx - 16 * cosA - 12 * sinA, y: 6, z: cz - 16 * sinA + 12 * cosA, ry }, 0);
        gl.drawMesh(wheel, { x: cx - 16 * cosA + 12 * sinA, y: 6, z: cz - 16 * sinA - 12 * cosA, ry }, 0);

        gl.drawMesh(headlight, { x: cx + 22 * cosA - 8 * sinA, y: 16, z: cz + 22 * sinA + 8 * cosA, ry }, 1.0);
        gl.drawMesh(headlight, { x: cx + 22 * cosA + 8 * sinA, y: 16, z: cz + 22 * sinA - 8 * cosA, ry }, 1.0);

        if (car.isPolice) {
          const flash = Math.floor(time * 8) % 2 === 0;
          const barL = getBoxMesh(6, 6, 12, flash ? PALETTE.policeLightA : '#333333');
          const barR = getBoxMesh(6, 6, 12, !flash ? PALETTE.policeLightB : '#333333');
          gl.drawMesh(barL, { x: cx, y: 46, z: cz - 4, ry }, 1.0);
          gl.drawMesh(barR, { x: cx, y: 46, z: cz + 4, ry }, 1.0);
        }

        if (isPlayerCar) {
          const ring = getCylinderMesh(CAR.length * 0.7, CAR.length * 0.7, 3, 16, PALETTE.player);
          gl.drawMesh(ring, { x: cx, y: 2, z: cz, ry: 0 }, 0.9);
        }
      }
    }

    // 10. Pedestrians
    if (state.peds) {
      let pIdx = 0;
      for (const ped of state.peds) {
        const col = PALETTE.ped[pIdx % PALETTE.ped.length];
        pIdx++;
        const pBody = getBoxMesh(10, 24, 10, col);
        const pHead = getBoxMesh(8, 8, 8, '#ffdbac');
        gl.drawMesh(pBody, { x: ped.x, y: 12, z: ped.y, ry: -ped.angle }, 0.1);
        gl.drawMesh(pHead, { x: ped.x, y: 28, z: ped.y, ry: 0 }, 0.1);
      }
    }

    // 11. On-Foot Player
    if (player.onFoot) {
      const pBody = getBoxMesh(12, 28, 12, PALETTE.player);
      const pHead = getBoxMesh(10, 10, 10, '#ffdbac');
      const ry = -player.angle;
      gl.drawMesh(pBody, { x: player.x, y: 16, z: player.y, ry }, 0.2);
      gl.drawMesh(pHead, { x: player.x, y: 34, z: player.y, ry }, 0.2);

      const ring = getCylinderMesh(18, 18, 3, 16, PALETTE.player);
      gl.drawMesh(ring, { x: player.x, y: 2, z: player.y, ry: 0 }, 0.9);
    }

    // 12. Helicopter
    if (state.heli && state.heli.active) {
      const h = state.heli;
      const hBody = getBoxMesh(60, 24, 30, PALETTE.heli);
      const hTail = getBoxMesh(50, 12, 12, PALETTE.heli);
      const rotor = getBoxMesh(140, 4, 10, '#aaaaaa');
      gl.drawMesh(hBody, { x: h.x, y: h.alt, z: h.y, ry: -h.angle }, 0.2);
      gl.drawMesh(hTail, { x: h.x - 45 * Math.cos(h.angle), y: h.alt + 6, z: h.y - 45 * Math.sin(h.angle), ry: -h.angle }, 0.2);
      gl.drawMesh(rotor, { x: h.x, y: h.alt + 16, z: h.y, ry: time * 15 }, 0.5);

      // Searchlight pool on ground
      const lightPool = getQuadMesh(120, 120, '#ffffcc');
      gl.drawMesh(lightPool, { x: player.x, y: 3, z: player.y, ry: 0 }, 0.9);
    }

    gl.end();

    // --- 2D HUD / Overlays ---
    ctx.clearRect(0, 0, 1280, 720);

    if (screen === SCREEN_PLAY) {
      // Top-Left: Money & Health
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect(20, 20, 240, 80);
      ctx.strokeStyle = PALETTE.muted;
      ctx.strokeRect(20, 20, 240, 80);

      ctx.fillStyle = PALETTE.money;
      ctx.font = `bold 28px ${FONT}`;
      ctx.fillText(`$ ${state.money || 0}`, 36, 56);

      // Health bar
      ctx.fillStyle = PALETTE.muted;
      ctx.fillRect(36, 68, 200, 16);
      const hp = Math.max(0, Math.min(100, state.health !== undefined ? state.health : 100));
      ctx.fillStyle = hp > 30 ? '#43a047' : '#e5534b';
      ctx.fillRect(36, 68, 2 * hp, 16);

      // Top-Centre: Wanted Stars
      const wanted = state.wanted || 0;
      if (wanted > 0) {
        ctx.fillStyle = PALETTE.hudPanel;
        ctx.fillRect(540, 20, 200, 50);
        ctx.fillStyle = '#ffd166';
        ctx.font = `bold 24px ${FONT}`;
        let starsStr = '';
        for (let i = 0; i < 5; i++) {
          starsStr += i < wanted ? '★ ' : '☆ ';
        }
        ctx.textAlign = 'center';
        ctx.fillText(starsStr, 640, 52);
        ctx.textAlign = 'left';
      }

      // Top-Right: Minimap
      const mmX = 1060, mmY = 20, mmW = 200, mmH = 140;
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect(mmX, mmY, mmW, mmH);
      ctx.strokeStyle = PALETTE.muted;
      ctx.strokeRect(mmX, mmY, mmW, mmH);

      // Draw minimap contents
      ctx.save();
      ctx.beginPath();
      ctx.rect(mmX, mmY, mmW, mmH);
      ctx.clip();

      const scaleX = mmW / WORLD.width;
      const scaleY = mmH / WORLD.height;

      // Roads on minimap
      ctx.strokeStyle = '#4a526d';
      ctx.lineWidth = 4;
      if (state.roads) {
        for (const rx of state.roads.vertical) {
          ctx.beginPath();
          ctx.moveTo(mmX + rx * scaleX, mmY);
          ctx.lineTo(mmX + rx * scaleX, mmY + mmH);
          ctx.stroke();
        }
        for (const ry of state.roads.horizontal) {
          ctx.beginPath();
          ctx.moveTo(mmX, mmY + ry * scaleY);
          ctx.lineTo(mmX + mmW, mmY + ry * scaleY);
          ctx.stroke();
        }
      }

      // Mission target on minimap
      if (state.mission && state.mission.target) {
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(mmX + state.mission.target.x * scaleX, mmY + state.mission.target.y * scaleY, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Police on minimap
      if (state.cars) {
        for (const c of state.cars) {
          if (c.isPolice) {
            ctx.fillStyle = '#e5534b';
            ctx.fillRect(mmX + c.x * scaleX - 2, mmY + c.y * scaleY - 2, 4, 4);
          }
        }
      }

      // Player on minimap
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(mmX + player.x * scaleX, mmY + player.y * scaleY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Top-Right under minimap: Radio display if present
      if (state.radio) {
        ctx.fillStyle = PALETTE.hudPanel;
        ctx.fillRect(1060, 170, 200, 40);
        ctx.fillStyle = PALETTE.objective;
        ctx.font = `14px ${FONT}`;
        ctx.fillText(`♪ ${state.radio}`, 1072, 195);
      }

      // Bottom-Centre: Mission Banner
      if (state.mission) {
        ctx.fillStyle = PALETTE.hudPanel;
        ctx.fillRect(340, 600, 600, 90);
        ctx.strokeStyle = PALETTE.objective;
        ctx.strokeRect(340, 600, 600, 90);

        ctx.fillStyle = PALETTE.objective;
        ctx.font = `bold 18px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(`MISSION: ${state.mission.title || 'Job'}`, 640, 630);

        ctx.fillStyle = PALETTE.text;
        ctx.font = `15px ${FONT}`;
        ctx.fillText(state.mission.text || state.mission.brief || '', 640, 656);

        if (state.mission.timer !== undefined && state.mission.timer > 0) {
          ctx.fillStyle = '#ff7e3d';
          ctx.font = `bold 16px ${FONT}`;
          ctx.fillText(`Time: ${Math.ceil(state.mission.timer)}s`, 640, 680);
        }
        ctx.textAlign = 'left';
      }

      // Bottom-Left: Contextual Hint
      ctx.fillStyle = PALETTE.hudPanel;
      ctx.fillRect(20, 660, 300, 40);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `14px ${FONT}`;
      let hint = 'WASD — Move / Drive  |  R — Radio  |  Space — Handbrake';
      if (player.onFoot) {
        if (state.nearCar) hint = 'E — Steal car  |  WASD — Move';
        else if (state.nearCop) hint = 'F — Punch Cop  |  WASD — Move';
        else hint = 'WASD — Move  |  Space — Jump / Action';
      } else {
        hint = 'E — Exit car  |  WASD — Drive  |  Space — Handbrake';
      }
      ctx.fillText(hint, 32, 685);

      // Notification Message popup
      if (state.message && state.messageTimer > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.8)';
        ctx.fillRect(380, 140, 520, 50);
        ctx.strokeStyle = '#ffd166';
        ctx.strokeRect(380, 140, 520, 50);
        ctx.fillStyle = '#ffd166';
        ctx.font = `bold 20px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(state.message, 640, 172);
        ctx.textAlign = 'left';
      }
    } else if (screen === SCREEN_TITLE) {
      // Dark gradient overlay
      const grad = ctx.createLinearGradient(0, 0, 0, 720);
      grad.addColorStop(0, 'rgba(25, 15, 45, 0.75)');
      grad.addColorStop(1, 'rgba(10, 8, 20, 0.90)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 56px ${FONT}`;
      ctx.fillText('VICE POINT 3D', 640, 240);

      ctx.fillStyle = PALETTE.text;
      ctx.font = `22px ${FONT}`;
      ctx.fillText('A small-time driver. A neon city. Seven jobs.', 640, 290);

      ctx.fillStyle = PALETTE.objective;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('Press Space or Click to Start', 640, 420);

      if (best > 0) {
        ctx.fillStyle = PALETTE.money;
        ctx.font = `18px ${FONT}`;
        ctx.fillText(`Best Score / Money: $ ${best}`, 640, 480);
      }
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_PAUSED) {
      ctx.fillStyle = 'rgba(10, 10, 20, 0.85)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `bold 44px ${FONT}`;
      ctx.fillText('PAUSED', 640, 320);

      ctx.fillStyle = PALETTE.objective;
      ctx.font = `20px ${FONT}`;
      ctx.fillText('Press Space to Resume', 640, 380);
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_OVER) {
      ctx.fillStyle = 'rgba(20, 5, 5, 0.9)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#e5534b';
      ctx.font = `bold 52px ${FONT}`;
      ctx.fillText(state.busted ? 'BUSTED' : 'WASTED', 640, 280);

      ctx.fillStyle = PALETTE.text;
      ctx.font = `22px ${FONT}`;
      ctx.fillText(`Final Money: $ ${state.money || 0}`, 640, 340);

      ctx.fillStyle = PALETTE.objective;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('Press Space to Try Again', 640, 440);
      ctx.textAlign = 'left';
    } else if (screen === SCREEN_WIN) {
      ctx.fillStyle = 'rgba(10, 25, 20, 0.9)';
      ctx.fillRect(0, 0, 1280, 720);

      ctx.textAlign = 'center';
      ctx.fillStyle = '#ffd166';
      ctx.font = `bold 52px ${FONT}`;
      ctx.fillText('KINGPIN OF VICE POINT', 640, 240);

      ctx.fillStyle = PALETTE.text;
      ctx.font = `24px ${FONT}`;
      ctx.fillText('You conquered the city and secured the empire.', 640, 300);

      ctx.fillStyle = PALETTE.money;
      ctx.font = `bold 28px ${FONT}`;
      ctx.fillText(`Total Wealth: $ ${state.money || 0}`, 640, 360);

      ctx.fillStyle = PALETTE.objective;
      ctx.font = `bold 20px ${FONT}`;
      ctx.fillText('Press Space to Play Again', 640, 460);
      ctx.textAlign = 'left';
    }
  }

  return {
    draw
  };
}
