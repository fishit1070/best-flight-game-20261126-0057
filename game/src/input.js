// input.js — keyboard state and mouse handling for on-screen buttons.
// The game reads this module's state each frame; nothing here moves the plane.

export const KEYS = {
  pitchUp: ['ArrowUp', 'KeyW'],
  pitchDown: ['ArrowDown', 'KeyS'],
  rollLeft: ['ArrowLeft', 'KeyA'],
  rollRight: ['ArrowRight', 'KeyD'],
  throttleUp: ['ShiftLeft', 'ShiftRight'],
  throttleDown: ['ControlLeft', 'ControlRight'],
  gear: ['KeyG'],
  flaps: ['KeyF'],
  airbrake: ['Space'],
  pause: ['KeyP'],
  mute: ['KeyM'],
  reset: ['KeyR'],
  camera: ['KeyC'],
  confirm: ['Enter'],
};

const heldKeys = new Set();
const pressedKeys = new Set(); // edge-triggered: consumed once per frame

export function isHeld(actionName) {
  return KEYS[actionName].some((code) => heldKeys.has(code));
}

// True once, on the frame the key went down. Cleared by endFrame().
export function wasPressed(actionName) {
  return KEYS[actionName].some((code) => pressedKeys.has(code));
}

export function endFrame() {
  pressedKeys.clear();
}

export function attachInput() {
  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    heldKeys.add(event.code);
    pressedKeys.add(event.code);
    // Space scrolls the page by default; the game owns it as the airbrake.
    if (event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    heldKeys.delete(event.code);
  });
  window.addEventListener('blur', () => {
    heldKeys.clear();
    pressedKeys.clear();
  });
}

// Mouse: on-screen buttons carry a data-action attribute; the callback
// receives the action name. Also used by the camera toggle button.
export function attachButtons(container, onAction) {
  container.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action]');
    if (!button) return;
    onAction(button.dataset.action, button);
  });
}

// Analog-style pitch/roll input in -1..1, from keys held this frame.
export function readStick() {
  let pitch = 0;
  let roll = 0;
  if (isHeld('pitchUp')) pitch += 1;
  if (isHeld('pitchDown')) pitch -= 1;
  if (isHeld('rollLeft')) roll -= 1;
  if (isHeld('rollRight')) roll += 1;
  return { pitch, roll };
}

export function readThrottleInput() {
  let delta = 0;
  if (isHeld('throttleUp')) delta += 1;
  if (isHeld('throttleDown')) delta -= 1;
  return delta;
}
