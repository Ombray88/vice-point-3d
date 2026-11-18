/**
 * input.js — Input handling for Vice Point 3D
 *
 * Exports:
 *   createInput(canvas) -> input controller object with read(), mouse, attach(), detach().
 */

export function createInput(canvas) {
  const keys = new Set();
  const pressedEdges = new Set();

  let mouseX = 0;
  let mouseY = 0;
  let mouseClicked = false;
  let mouseClickedConsumed = false;

  const keyMap = {
    'KeyW': 'up', 'ArrowUp': 'up',
    'KeyS': 'down', 'ArrowDown': 'down',
    'KeyA': 'left', 'ArrowLeft': 'left',
    'KeyD': 'right', 'ArrowRight': 'right',
    'KeyE': 'enter',
    'KeyF': 'action',
    'KeyR': 'radio',
    'KeyP': 'pause', 'Escape': 'pause',
    'KeyM': 'mute',
    'Space': 'handbrake'
  };

  function onKeyDown(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    const action = keyMap[e.code];
    if (action) {
      if (!keys.has(action)) {
        pressedEdges.add(action);
      }
      keys.add(action);
    }
  }

  function onKeyUp(e) {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
    const action = keyMap[e.code];
    if (action) {
      keys.delete(action);
    }
  }

  function onMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / (rect.width || 1280);
    const scaleY = 720 / (rect.height || 720);
    mouseX = (e.clientX - rect.left) * scaleX;
    mouseY = (e.clientY - rect.top) * scaleY;
  }

  function onMouseDown(e) {
    if (e.button === 0) {
      mouseClicked = true;
      mouseClickedConsumed = false;
    }
  }

  function attach() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mousedown', onMouseDown);
  }

  function detach() {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    canvas.removeEventListener('mousemove', onMouseMove);
    canvas.removeEventListener('mousedown', onMouseDown);
    keys.clear();
    pressedEdges.clear();
  }

  return {
    read() {
      let mx = 0;
      let my = 0;
      if (keys.has('left')) mx -= 1;
      if (keys.has('right')) mx += 1;
      if (keys.has('up')) my -= 1;
      if (keys.has('down')) my += 1;

      const enter = pressedEdges.has('enter');
      const action = pressedEdges.has('action');
      const radio = pressedEdges.has('radio');
      const pause = pressedEdges.has('pause');
      const mute = pressedEdges.has('mute');
      const handbrake = keys.has('handbrake');

      pressedEdges.clear();

      return { mx, my, enter, action, handbrake, radio, pause, mute };
    },
    mouse: {
      get x() { return mouseX; },
      get y() { return mouseY; },
      get clicked() {
        if (mouseClicked && !mouseClickedConsumed) {
          mouseClickedConsumed = true;
          return true;
        }
        return false;
      }
    },
    attach,
    detach
  };
}
