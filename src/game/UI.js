export class UI {
  constructor(game) {
    this.game = game;

    // Cache DOM Elements
    this.mainMenu = document.getElementById('mainMenu');
    this.controlsMenu = document.getElementById('controlsMenu');
    this.gameOverScreen = document.getElementById('gameOverScreen');
    this.pauseMenu = document.getElementById('pauseMenu');
    this.dialogueBox = document.getElementById('dialogueBox');
    this.dialogueText = document.getElementById('dialogueText');
    
    this.btnStart = document.getElementById('btnStart');
    this.btnControls = document.getElementById('btnControls');
    this.btnControlsBack = document.getElementById('btnControlsBack');
    this.btnRespawn = document.getElementById('btnRespawn');
    this.btnResume = document.getElementById('btnResume');
    this.btnQuit = document.getElementById('btnQuit');
    this.btnMute = document.getElementById('btnMute');
    this.speakerPath = document.getElementById('speakerPath');

    this.bindEvents();
  }

  bindEvents() {
    this.btnStart.addEventListener('click', () => {
      this.game.sound.init(); // Init audio context on interaction
      this.game.startNewGame();
    });

    this.btnControls.addEventListener('click', () => {
      this.showScreen('controlsMenu');
    });

    this.btnControlsBack.addEventListener('click', () => {
      this.showScreen('mainMenu');
    });

    this.btnRespawn.addEventListener('click', () => {
      this.game.respawnPlayer();
    });

    this.btnResume.addEventListener('click', () => {
      this.game.resumeGame();
    });

    this.btnQuit.addEventListener('click', () => {
      this.showScreen('mainMenu');
      this.game.state = 'MENU';
    });

    this.btnMute.addEventListener('click', () => {
      this.game.sound.init();
      const isMuted = this.game.sound.toggleMute();
      this.updateMuteIcon(isMuted);
    });
  }

  showScreen(screenId) {
    // Hide all
    this.mainMenu.classList.add('hidden');
    this.controlsMenu.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');
    this.pauseMenu.classList.add('hidden');

    // Show selected
    const el = document.getElementById(screenId);
    if (el) el.classList.remove('hidden');

    // Manage cursor visibility
    if (screenId === 'playing') {
      document.body.classList.add('hide-cursor');
    } else {
      document.body.classList.remove('hide-cursor');
    }
  }

  updateMuteIcon(isMuted) {
    if (isMuted) {
      // Muted - slash speaker shape or change path fill opacity
      this.speakerPath.setAttribute('d', 'M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.21.05-.42.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73 4.27 3zM12 4L9.91 6.09 12 8.18V4z');
      this.speakerPath.setAttribute('fill', '#7f8c8d');
    } else {
      // Full volume speaker
      this.speakerPath.setAttribute('d', 'M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z');
      this.speakerPath.setAttribute('fill', 'white');
    }
  }

  showDialogue(text) {
    this.dialogueText.innerText = text;
    this.dialogueBox.classList.remove('hidden');
    document.body.classList.remove('hide-cursor');
  }

  hideDialogue() {
    this.dialogueBox.classList.add('hidden');
    if (this.game.state === 'PLAYING') {
      document.body.classList.add('hide-cursor');
    }
  }

  drawHUD(ctx, player, boss, camera) {
    ctx.save();
    
    // Apply camera shake to HUD for highly immersive impacts!
    const camShake = camera.getPos();
    const shakeOffsetX = camShake.x - camera.x;
    const shakeOffsetY = camShake.y - camera.y;
    ctx.translate(shakeOffsetX, shakeOffsetY);

    // 1. Draw Ornate Skull-themed Soul Vessel Container
    const vx = 45;
    const vy = 40;
    const vr = 22;

    ctx.save();
    ctx.strokeStyle = '#0f141d';
    ctx.lineWidth = 3.5;
    ctx.fillStyle = '#060a12';
    
    // Draw Glass Sphere base
    ctx.beginPath();
    ctx.arc(vx, vy, vr, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Soul fluid filling (shining white liquid inside the sphere)
    if (player.soul > 0) {
      const fillRatio = player.soul / player.maxSoul;
      
      ctx.save();
      ctx.beginPath();
      ctx.arc(vx, vy, vr - 2.5, 0, Math.PI * 2);
      ctx.clip();
      
      const fluidHeight = (vr * 2) * fillRatio;
      
      // Pulse glow
      const fillGlow = player.soul >= 33 ? 12 + Math.sin(Date.now() * 0.01) * 3 : 2;
      ctx.fillStyle = player.soul >= 99 ? '#ffffff' : player.soul >= 33 ? '#f0f3f4' : '#bdc3c7';
      ctx.shadowBlur = fillGlow;
      ctx.shadowColor = '#ffffff';
      
      ctx.fillRect(vx - vr, vy + vr - fluidHeight, vr * 2, fluidHeight);
      ctx.restore();
    }
    
    // Draw Ornate Skull Frame Overlay on the Vessel (gothic bone look)
    ctx.strokeStyle = '#1b2530';
    ctx.fillStyle = '#d5dbdb'; // Metal rim
    ctx.lineWidth = 2.5;

    // Horns at top-left and top-right of the rim
    ctx.beginPath();
    // Left Horn
    ctx.moveTo(vx - 10, vy - 18);
    ctx.quadraticCurveTo(vx - 22, vy - 35, vx - 18, vy - 36);
    ctx.quadraticCurveTo(vx - 9, vy - 27, vx - 4, vy - 21);
    // Right Horn
    ctx.moveTo(vx + 10, vy - 18);
    ctx.quadraticCurveTo(vx + 22, vy - 35, vx + 18, vy - 36);
    ctx.quadraticCurveTo(vx + 9, vy - 27, vx + 4, vy - 21);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Inner rim lines
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vx, vy, vr, -Math.PI / 4, Math.PI * 1.25);
    ctx.stroke();

    ctx.restore();

    // 2. Draw Weathered Health Masks
    const maskStartX = 82;
    const maskY = 28;
    const maskSpacing = 24;

    for (let i = 0; i < player.maxHealth; i++) {
      const mx = maskStartX + i * maskSpacing;
      const my = maskY;
      const isBroken = i >= player.health;

      ctx.save();
      ctx.translate(mx, my);

      if (isBroken) {
        // Draw dark, fractured shell mask (shattered details)
        ctx.fillStyle = '#1b2532';
        ctx.strokeStyle = '#2d3d52';
        ctx.lineWidth = 1.8;

        ctx.beginPath();
        // A jagged fractured skull profile
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(8, 0, 8, 11);
        ctx.quadraticCurveTo(4, 21, 0, 24);
        ctx.lineTo(-2, 17);
        ctx.lineTo(-6, 14);
        ctx.lineTo(-1, 9);
        ctx.lineTo(-4, 3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Broken crack details
        ctx.strokeStyle = '#475569';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-1, 9); ctx.lineTo(3, 11);
        ctx.stroke();
      } else {
        // Draw weathered bone-colored mask
        ctx.fillStyle = '#f8f9f9';
        ctx.strokeStyle = '#0c131d';
        ctx.lineWidth = 2.2;
        ctx.shadowBlur = 5;
        ctx.shadowColor = 'rgba(255,255,255,0.3)';

        ctx.beginPath();
        // Hand-drawn organic look
        ctx.moveTo(0, -2);
        ctx.quadraticCurveTo(-8, 0, -8, 11);
        ctx.quadraticCurveTo(-4, 21, 0, 24);
        ctx.quadraticCurveTo(4, 21, 8, 11);
        ctx.quadraticCurveTo(8, 0, 0, -2);
        ctx.fill();
        ctx.stroke();

        // Deep hollow eye sockets
        ctx.fillStyle = '#0f141d';
        ctx.beginPath();
        ctx.ellipse(-3, 9, 2.2, 3.8, 0.05, 0, Math.PI * 2);
        ctx.ellipse(3, 9, 2.2, 3.8, -0.05, 0, Math.PI * 2);
        ctx.fill();

        // Hairline fractures for weathered texture
        ctx.strokeStyle = '#b2babb';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(-5, 2); ctx.lineTo(-3, 5); ctx.lineTo(-5, 7);
        ctx.moveTo(4, 18); ctx.lineTo(2, 21);
        ctx.stroke();
      }

      ctx.restore();
    }

    // 3. Draw Geo Counter
    const gx = 82;
    const gy = 66;

    // Draw little gold coin icon
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(gx, gy - 5);
    ctx.lineTo(gx + 4, gy);
    ctx.lineTo(gx, gy + 5);
    ctx.lineTo(gx - 4, gy);
    ctx.closePath();
    ctx.fillStyle = '#f1c40f';
    ctx.shadowBlur = 6;
    ctx.shadowColor = '#f39c12';
    ctx.fill();

    // Text Geo count
    ctx.fillStyle = '#eaeaea';
    ctx.font = "600 13px 'Outfit', sans-serif";
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowBlur = 0;
    ctx.fillText(player.geo, gx + 10, gy);
    
    ctx.restore();

    // 4. Draw Boss Health Bar (if active and not dead)
    if (boss && !boss.isDead) {
      const screenW = ctx.canvas.width;
      const screenH = ctx.canvas.height;
      const barW = 400;
      const barH = 14;
      const bx = (screenW - barW) / 2;
      const by = screenH - 60;

      ctx.save();
      
      // Boss Name Title
      ctx.fillStyle = '#f5b041'; // Golden Boss text
      ctx.font = "bold 15px 'Cinzel Decorative', Georgia, serif";
      ctx.textAlign = 'center';
      ctx.letterSpacing = '5px';
      ctx.fillText("FALSE KNIGHT", screenW / 2, by - 12);

      // Back plate
      ctx.fillStyle = 'rgba(10, 15, 25, 0.75)';
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(bx, by, barW, barH, 3);
      ctx.fill();
      ctx.stroke();

      // Active health fill
      if (boss.hp > 0) {
        const hpRatio = boss.hp / boss.maxHp;
        const fillW = (barW - 4) * hpRatio;
        
        const grad = ctx.createLinearGradient(bx, by, bx + barW, by);
        grad.addColorStop(0, '#c0392b');
        grad.addColorStop(1, '#ec7063');

        ctx.fillStyle = grad;
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#e74c3c';
        ctx.fillRect(bx + 2, by + 2, fillW, barH - 4);
      }

      ctx.restore();
    }

    ctx.restore();
  }
}
export default UI;
