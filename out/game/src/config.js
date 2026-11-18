/**
 * config.js — Game configuration and color palette for Vice Point 3D
 */

export const STEP = 1 / 60;
export const FIELD = { width: 1280, height: 720 };
export const WORLD = { width: 2560, height: 1920 };

export const PLAYER = {
  radius: 10,
  walkSpeed: 170,
  health: 100
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 600,
  reverseAccel: 260,
  maxSpeed: 520,
  maxReverse: 160,
  turnRate: 2.6,
  grip: 3.2
};

export const TRAFFIC = {
  count: 14,
  speedMin: 90,
  speedMax: 150
};

export const PEDS = {
  count: 22,
  speedMin: 28,
  speedMax: 55
};

export const POLICE = {
  chaseSpeed: 540,
  ramDamage: 8,
  spawnDistance: 500
};

export const HELI = {
  altitude: 160,
  speed: 320,
  searchRadius: 90
};

export const WANTED = {
  decayDelay: 6,
  decayRate: 0.25,
  max: 5
};

export const SAVE_KEY = 'vice-point-3d.save';
export const BEST_KEY = 'vice-point-3d.best';

export const PALETTE = {
  skyTop: '#2b1a4d',
  skyBottom: '#ff7e3d',
  fog: '#e07840',
  asphalt: '#232733',
  roadLine: '#c9a227',
  sidewalk: '#3a3f4d',
  building: [
    '#323746',
    '#3c4355',
    '#485066',
    '#2c3240',
    '#423a52',
    '#384859',
    '#524248',
    '#2e4045'
  ],
  windowsLit: '#ffd166',
  windowsDark: '#2b3040',
  park: '#1f4d2e',
  sand: '#c2a878',
  water: '#14425e',
  player: '#4fc3f7',
  police: '#e5534b',
  policeLightA: '#ff3b30',
  policeLightB: '#3b82f6',
  heli: '#3a3f4d',
  trafficCar: ['#e63946', '#f1faee', '#a8dadc', '#457b9d', '#1d3557', '#e9c46a', '#f4a261', '#2a9d8f'],
  ped: ['#ffb703', '#fb8500', '#023047', '#219ebc', '#8ecae6', '#b5179e', '#7209b7', '#3f37c9'],
  hudPanel: 'rgba(10,12,20,0.72)',
  text: '#eef1f5',
  muted: '#8b93a3',
  objective: '#ffd166',
  money: '#7ee787'
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
