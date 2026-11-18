/**
 * main.js — Main game loop and controller for Vice Point 3D
 *
 * Implements the initialization, URL query parsing (?seed=, ?shot=),
 * game screens (title, play, paused, over, win), fixed timestep updates,
 * event handling, and localStorage persistence.
 */

import { createWorld, EVENT_OVER, EVENT_BUSTED, EVENT_MISSION } from './world.js';
import { createRandom } from './random.js';
import { createRenderer, SCREEN_TITLE, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_OVER, SCREEN_WIN } from './render.js';
import { stageShot } from './shots.js';
import { createInput } from './input.js';
import { STEP, SAVE_KEY, BEST_KEY, CAR } from './config.js';
import { createAudio } from './audio.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game');
  if (!canvas) return;

  // URL parameters
  const urlParams = new URLSearchParams(window.location.search);
  const seedParam = urlParams.get('seed');
  const seed = seedParam !== null ? parseInt(seedParam, 10) : Math.floor(Math.random() * 1000000);
  const shotParam = urlParams.get('shot');

  const rng = createRandom(seed);
  const world = createWorld(rng);
  const renderer = createRenderer(canvas);
  const input = createInput(canvas);
  input.attach();

  const audio = createAudio();
  world.state.radio = audio.currentStation();

  let screen = SCREEN_TITLE;
  let bestMoney = 0;
  try {
    const savedBest = localStorage.getItem(BEST_KEY);
    if (savedBest) bestMoney = parseInt(savedBest, 10) || 0;
  } catch (e) {
    // ignore storage errors
  }

  // Handle ?shot= mode if present
  if (shotParam) {
    try {
      const shot = stageShot(shotParam, world);
      const shotScreen = (shot && shot.screen) || SCREEN_PLAY;
      const shotBest = (shot && typeof shot.best === 'number') ? shot.best : bestMoney;
      renderer.draw(world.state, shotScreen, shotBest);
      renderer.draw(world.state, shotScreen, shotBest);
      window.__shotReady = true;
    } catch (e) {
      console.error('Error staging shot:', e);
    }
    return;
  }

  // Handle visibility pause
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      audio.setPaused(true);
    }
  });

  let lastTime = performance.now();
  let accumulator = 0;
  let lastPlayerSpeed = 0;

  function loop(currentTime) {
    requestAnimationFrame(loop);

    const frameTime = (currentTime - lastTime) / 1000;
    lastTime = currentTime;
    accumulator += Math.min(frameTime, 0.25);

    const inputs = input.read();

    if (inputs.radio) {
      audio.setStation((audio.currentStation().index + 1) % 3);
      world.state.radio = audio.currentStation();
    }

    if (inputs.mute) {
      audio.setMuted(!audio.isMuted());
    }

    // Pause toggling
    if (inputs.pause) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        audio.setPaused(true);
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        audio.setPaused(false);
      }
    }

    if (screen === SCREEN_TITLE) {
      // Attract mode: step world with attract = true, no player input
      while (accumulator >= STEP) {
        world.step(STEP, { mx: 0, my: 0, enter: false, action: false, handbrake: false }, true);
        accumulator -= STEP;
      }
      renderer.draw(world.state, SCREEN_TITLE, bestMoney);

      if (inputs.enter || inputs.action || inputs.handbrake || input.mouse.clicked) {
        audio.resume();
        world.reset();
        screen = SCREEN_PLAY;
        audio.setPaused(false);
      }
    } else if (screen === SCREEN_PLAY) {
      audio.tick(frameTime);

      const pSpeed = world.state.player.onFoot ? 0 : world.state.player.speed;
      audio.setSpeed(pSpeed, CAR.maxSpeed);
      audio.setWanted(world.state.wanted);

      // Check hard crash (sudden speed drop in car)
      if (!world.state.player.onFoot && lastPlayerSpeed - pSpeed > 250 && Math.abs(pSpeed) < 50) {
        if (typeof audio.crash === 'function') audio.crash();
      }
      lastPlayerSpeed = pSpeed;

      while (accumulator >= STEP) {
        const events = world.step(STEP, inputs, false);

        if (events & EVENT_BUSTED) {
          world.state.busted = true;
          screen = SCREEN_OVER;
          updateBest(world.state.money);
        } else if (events & EVENT_OVER) {
          world.state.busted = false;
          screen = SCREEN_OVER;
          updateBest(world.state.money);
        } else if (events & EVENT_MISSION) {
          // Mission progress / completion
          if (typeof audio.complete === 'function') audio.complete();
          try {
            localStorage.setItem(SAVE_KEY, String(world.state.money || 0));
          } catch (e) {}
        }

        if (world.state.win) {
          screen = SCREEN_WIN;
          updateBest(world.state.money);
        }

        accumulator -= STEP;
      }
      renderer.draw(world.state, SCREEN_PLAY, bestMoney);
    } else if (screen === SCREEN_PAUSED) {
      accumulator = 0; // discard delta during pause
      renderer.draw(world.state, SCREEN_PAUSED, bestMoney);
      if (inputs.enter || inputs.handbrake) {
        screen = SCREEN_PLAY;
        audio.setPaused(false);
      }
    } else if (screen === SCREEN_OVER || screen === SCREEN_WIN) {
      accumulator = 0;
      renderer.draw(world.state, screen, bestMoney);
      if (inputs.enter || inputs.action || inputs.handbrake || input.mouse.clicked) {
        audio.resume();
        world.reset();
        screen = SCREEN_PLAY;
        audio.setPaused(false);
      }
    }
  }

  function updateBest(money) {
    if (money > bestMoney) {
      bestMoney = money;
      try {
        localStorage.setItem(BEST_KEY, String(bestMoney));
      } catch (e) {}
    }
  }

  requestAnimationFrame((time) => {
    lastTime = time;
    requestAnimationFrame(loop);
  });
});
