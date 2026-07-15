export class Input {
  constructor() {
    this.keys = {};
    this.prevKeys = {};

    this.keyMap = {
      // Directions (WASD movement)
      left: ['ArrowLeft', 'KeyA'],
      right: ['ArrowRight', 'KeyD'],
      up: ['ArrowUp', 'KeyW'],      // W is look up
      down: ['ArrowDown', 'KeyS'],
      
      // Actions
      jump: ['Space', 'KeyC'],
      dash: ['ShiftLeft', 'ShiftRight', 'KeyX', 'MouseRight'],
      attack: ['KeyZ', 'KeyJ', 'MouseLeft'],
      focus: ['KeyF', 'KeyE'],      // E / F is focus heal
      spellCast: ['KeyQ'],          // Q = quick cast Vengeful Spirit
      
      // System
      pause: ['Escape', 'Enter'],
      interact: ['Space', 'KeyS']
    };

    this.cheatBuffer = "";
    this.godMode = false;

    // Keyboard Listeners
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Mouse Click Listeners (Left click attack, Right click dash)
    window.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    window.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    window.addEventListener('contextmenu', (e) => e.preventDefault()); // Disable context menu
  }

  handleKeyDown(e) {
    const keysToPrevent = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
    if (keysToPrevent.includes(e.key)) {
      e.preventDefault();
    }
    this.keys[e.code] = true;

    // Process secret cheat code "godmod"
    if (e.key && e.key.length === 1) {
      this.cheatBuffer += e.key.toLowerCase();
      this.cheatBuffer = this.cheatBuffer.slice(-10);
      if (this.cheatBuffer.endsWith('godmod')) {
        this.godMode = !this.godMode;
        console.log("%c[CHEAT] GOD MODE: " + (this.godMode ? "ENABLED" : "DISABLED"), "color: #2ecc71; font-weight: bold; font-size: 14px;");
        this.cheatBuffer = ""; // Reset buffer
      }
    }
  }

  handleKeyUp(e) {
    this.keys[e.code] = false;
  }

  handleMouseDown(e) {
    if (e.button === 0) {
      this.keys['MouseLeft'] = true;
    } else if (e.button === 2) {
      this.keys['MouseRight'] = true;
      e.preventDefault();
    }
  }

  handleMouseUp(e) {
    if (e.button === 0) {
      this.keys['MouseLeft'] = false;
    } else if (e.button === 2) {
      this.keys['MouseRight'] = false;
    }
  }

  update() {
    // Save state of previous frame
    this.prevKeys = { ...this.keys };
  }

  isDown(action) {
    const codes = this.keyMap[action];
    if (!codes) return false;
    return codes.some(code => this.keys[code]);
  }

  wasPressed(action) {
    const codes = this.keyMap[action];
    if (!codes) return false;
    return codes.some(code => this.keys[code] && !this.prevKeys[code]);
  }

  wasReleased(action) {
    const codes = this.keyMap[action];
    if (!codes) return false;
    return codes.some(code => !this.keys[code] && this.prevKeys[code]);
  }

  reset() {
    this.keys = {};
    this.prevKeys = {};
  }
}
export default Input;
