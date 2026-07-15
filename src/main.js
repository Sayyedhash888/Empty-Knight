import { Game } from './game/Game.js';

window.addEventListener('DOMContentLoaded', () => {
  const game = new Game();
  
  // Expose game instance to console window for easy testing/debugging
  window.game = game;
});
