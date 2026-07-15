import { Input } from './Input.js';
import { SoundManager } from './Sound.js';
import { Camera } from './Camera.js';
import { Level } from './Level.js';
import { Player } from './Player.js';
import { ParticleSystem } from './Particles.js';
import { UI } from './UI.js';
import { Crawlid, Vengefly, FalseKnight } from './Enemies.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');
    
    // Core engine subsystems
    this.input = new Input();
    this.sound = new SoundManager();
    this.camera = new Camera(this.canvas.width, this.canvas.height);
    this.level = new Level();
    this.particles = new ParticleSystem();
    this.ui = new UI(this);

    // Gameplay states
    this.state = 'MENU'; // 'MENU', 'PLAYING', 'PAUSED', 'DIALOGUE', 'GAMEOVER'
    this.player = null;
    
    // Entities
    this.enemies = [];
    this.shockwaves = [];
    this.spells = [];    // Active spell projectiles
    this.activeBoss = null;
    
    // Monarch wings physical pickup item (spawns when boss is defeated)
    this.monarchWingsPickup = null;

    // Dialogue state
    this.activeDialogueText = "";
    this.closeDialogueCooldown = 0;

    // Timers
    this.lastTime = 0;
    this.gameOverDelay = 0;
    this.hitFreezeTimer = 0;

    // Image Asset Cache
    this.assets = {
      knight: new Image(),
      dirtmouthBg: new Image(),
      cavernBg: new Image(),
      falseKnight: new Image(),
      falseKnightLeap: new Image(),
      falseKnightAttack: new Image()
    };
    
    this.processedAssets = {};

    const preprocess = (key, img) => {
      img.onload = () => {
        this.processedAssets[key] = this.makeBlackTransparent(img);
      };
    };

    this.assets.knight.src = '/assets/knight.png';
    this.assets.dirtmouthBg.src = '/assets/dirtmouth_bg.png';
    this.assets.cavernBg.src = '/assets/cavern_bg.png';
    this.assets.falseKnight.src = '/assets/false_knight.png';
    this.assets.falseKnightLeap.src = '/assets/false_knight_leap.png';
    this.assets.falseKnightAttack.src = '/assets/false_knight_attack.png';

    preprocess('knight', this.assets.knight);
    preprocess('dirtmouthBg', this.assets.dirtmouthBg);
    preprocess('cavernBg', this.assets.cavernBg);
    preprocess('falseKnight', this.assets.falseKnight);
    preprocess('falseKnightLeap', this.assets.falseKnightLeap);
    preprocess('falseKnightAttack', this.assets.falseKnightAttack);

    // Setup viewport
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Offscreen lighting mask canvas
    this.lightCanvas = document.createElement('canvas');
    this.lightCanvas.width = 960;
    this.lightCanvas.height = 540;
    this.lightCtx = this.lightCanvas.getContext('2d');
  }

  resizeCanvas() {
    // 16:9 HD virtual aspect ratio base (e.g. 960x540)
    // Scale canvas to window size but keep layout sharp
    const scale = Math.min(window.innerWidth / 960, window.innerHeight / 540);
    this.canvas.width = Math.round(960 * scale);
    this.canvas.height = Math.round(540 * scale);
    
    // Normalize rendering scaling factor
    this.ctx.imageSmoothingEnabled = false;
    this.camera.resize(960, 540);
    
    // Set level camera boundaries
    this.updateCameraBounds();
  }

  updateCameraBounds() {
    if (this.level) {
      const room = this.level.currentRoom;
      const w = room.grid[0].length * this.level.tileSize;
      const h = room.grid.length * this.level.tileSize;
      this.camera.setBounds(0, 0, w, h);
    }
  }

  startNewGame() {
    // Spawn player in Dirtmouth (Room 0)
    this.player = new Player(200, 380);
    this.state = 'PLAYING';
    this.ui.showScreen('playing');

    // Load Room 0
    this.loadRoom(0, 200, 380);

    this.lastTime = performance.now();
    requestAnimationFrame((t) => this.gameLoop(t));
  }

  resumeGame() {
    this.state = 'PLAYING';
    this.ui.showScreen('playing');
  }

  pauseGame() {
    this.state = 'PAUSED';
    this.ui.showScreen('pauseMenu');
  }

  respawnPlayer() {
    // Reload player's saved spawn room and state
    this.player.respawnFull(this.level);
    this.loadRoom(this.player.respawnRoom, this.player.respawnX, this.player.respawnY);
    this.state = 'PLAYING';
    this.ui.showScreen('playing');
  }

  makeBlackTransparent(image) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0);
      
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Sample solid background color from top-left corner (0, 0)
      const bgR = data[0];
      const bgG = data[1];
      const bgB = data[2];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i+1];
        const b = data[i+2];

        // Color difference distance
        const dist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        const isBlack = (r < 18 && g < 18 && b < 18);

        // If pixel matches the background color within a threshold or is dark black, make transparent
        if (dist < 42 || isBlack) {
          data[i+3] = 0;
        }
      }
      ctx.putImageData(imgData, 0, 0);
      return canvas;
    } catch (e) {
      console.warn("Failed to preprocess image transparency:", e);
      return image;
    }
  }

  loadRoom(roomIndex, playerSpawnX, playerSpawnY) {
    this.level.loadRoom(roomIndex);
    this.updateCameraBounds();

    // Place player
    this.player.x = playerSpawnX;
    this.player.y = playerSpawnY;
    this.player.vx = 0;
    this.player.vy = 0;
    this.camera.follow(this.player.x, this.player.y, true); // Snap camera

    // Reset entities
    this.enemies = [];
    this.shockwaves = [];
    this.monarchWingsPickup = null;
    this.activeBoss = null;

    // Spawn Room Enemies from level config
    const room = this.level.currentRoom;
    room.enemies.forEach(eConfig => {
      let e = null;
      if (eConfig.type === 'crawlid') {
        e = new Crawlid(eConfig.x, eConfig.y);
      } else if (eConfig.type === 'vengefly') {
        e = new Vengefly(eConfig.x, eConfig.y);
      } else if (eConfig.type === 'boss') {
        // If boss is already dead in this game session, don't spawn it
        if (!this.player.doubleJumpUnlocked) {
          e = new FalseKnight(eConfig.x, eConfig.y);
          this.activeBoss = e;
        }
      }
      if (e) this.enemies.push(e);
    });

    // Clear old transient particles
    this.particles.particles = [];
    this.particles.slashes = [];
  }

  gameLoop(time) {
    // Cap delta time to prevent physics clipping (e.g. background tab freeze)
    let deltaTime = (time - this.lastTime) / 1000;
    if (deltaTime > 0.1) deltaTime = 0.1;
    this.lastTime = time;

    this.update(deltaTime);
    this.draw();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  update(deltaTime) {
    // Global Pause key check
    if (this.input.wasPressed('pause')) {
      if (this.state === 'PLAYING') {
        this.pauseGame();
      } else if (this.state === 'PAUSED') {
        this.resumeGame();
      }
    }

    // Process hit freeze frame pause
    if (this.hitFreezeTimer > 0) {
      this.hitFreezeTimer -= deltaTime;
      this.input.update();
      return;
    }

    // Read Player's hit freeze request (e.g. from Geo Rocks hits)
    if (this.player && this.player.wantsHitFreeze) {
      this.hitFreezeTimer = this.player.wantsHitFreeze;
      this.player.wantsHitFreeze = 0;
      this.input.update();
      return;
    }

    // Handlers based on state
    if (this.state === 'PLAYING') {
      this.updatePlaying(deltaTime);
    } 
    else if (this.state === 'DIALOGUE') {
      this.updateDialogue(deltaTime);
    }
    
    // Always tick input at the end of frame to update key transitions
    this.input.update();
  }

  updatePlaying(deltaTime) {
    // 1. Update Player
    this.player.update(deltaTime, this.input, this.level, this.particles, this.sound, this.camera);

    // 2. Camera follows player
    this.camera.follow(this.player.x + this.player.width/2, this.player.y + this.player.height/2);
    this.camera.update(deltaTime);

    // Update level animations
    this.level.update(deltaTime);

    // 3. Update Particle System and Spores
    this.particles.update(deltaTime, this.player, this.level);
    this.particles.updateAmbientSpores(deltaTime, this.camera, this.level.currentRoomIndex);

    // 4. Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      enemy.update(deltaTime, this.player, this.level, this.particles, this.sound, this.camera);
      
      // If boss spawned a shockwave, capture it
      if (enemy.type === 'boss' && enemy.spawnShockwave) {
        this.shockwaves.push(enemy.spawnShockwave);
        enemy.spawnShockwave = null;
      }

      if (enemy.isDead && enemy.hp <= 0) {
        // Boss Defeat event!
        if (enemy.type === 'boss') {
          this.handleBossDefeat(enemy);
        }
        this.enemies.splice(i, 1);
      }
    }

    // 5b. Spawn queued player spell projectile
    if (this.player.wantsCastSpell) {
      const s = this.player.wantsCastSpell;
      this.player.wantsCastSpell = null;
      if (s.type === 'vengefulSpirit') {
        const speed = 550;
        this.spells.push({
          type: 'vengefulSpirit',
          x: s.x - 10, y: s.y - 10, width: 20, height: 20,
          vx: s.facing === 'right' ? speed : -speed, vy: 0,
          life: 2.2, damage: s.damage
        });
      } else if (s.type === 'desolateDive') {
        // Desolate Dive: wide downward slam explosion — AoE at player feet on land
        this.spells.push({
          type: 'desolateDive',
          x: s.x - 60, y: s.y - 10, width: 120, height: 30,
          vx: 0, vy: 320,
          life: 0.7, damage: s.damage
        });
      } else if (s.type === 'howlingWraiths') {
        // Howling Wraiths: upward cone burst
        this.spells.push({
          type: 'howlingWraiths',
          x: s.x - 40, y: s.y - 80, width: 80, height: 80,
          vx: 0, vy: -200,
          life: 0.6, damage: s.damage
        });
      }
    }

    // 5. Update Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.life -= deltaTime;

    // 5c. Update Spell Projectiles
    for (let i = this.spells.length - 1; i >= 0; i--) {
      const sp = this.spells[i];
      sp.life -= deltaTime;
      sp.x += sp.vx * deltaTime;
      sp.y += sp.vy * deltaTime;

      // Check wall collision (remove on solid tile hit)
      if (this.level.isPositionSolid(sp.x + sp.width / 2, sp.y + sp.height / 2)) {
        this.particles.spawnHitSparks(sp.x + sp.width / 2, sp.y + sp.height / 2, 0, 8);
        this.spells.splice(i, 1);
        continue;
      }

      // Check enemy hit
      let hitEnemy = false;
      this.enemies.forEach(enemy => {
        if (!enemy.isDead && this.isRectOverlapping(sp, enemy)) {
          const angle = sp.vx > 0 ? 0 : Math.PI;
          enemy.takeDamage(sp.damage, angle, this.particles, this.sound, this.camera);
          this.hitFreezeTimer = 0.06;
          hitEnemy = true;
        }
      });

      // Check boss hit
      if (this.activeBoss && !this.activeBoss.isDead && this.isRectOverlapping(sp, this.activeBoss)) {
        this.activeBoss.takeDamage(sp.damage, sp.vx > 0 ? 0 : Math.PI, this.particles, this.sound, this.camera);
        this.hitFreezeTimer = 0.08;
        hitEnemy = true;
      }

      if (sp.life <= 0 || hitEnemy) {
        this.spells.splice(i, 1);
        continue;
      }
    }
      
      if (sw.life <= 0) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      sw.x += sw.vx * deltaTime;

      // Spawn dust along shockwave floor
      if (Math.random() < 0.25) {
        this.particles.spawnDust(sw.x + sw.width/2, sw.y + sw.height, 5, 10, 1);
      }

      // Check player overlap damage
      if (this.player.invincibilityTimer <= 0 && this.isRectOverlapping(this.player, sw)) {
        this.player.takeDamage(1, this.sound, this.particles, this.camera);
      }
    }

    // 6. Check Player Attack vs Enemies Collisions
    if (this.player.wantsAttackCollide) {
      const attack = this.player.wantsAttackCollide;
      let hitRegistered = false;

      this.enemies.forEach(enemy => {
        if (!enemy.isDead && this.isRectOverlapping(attack.area, enemy)) {
          // Attacking direction angle
          let angle = this.player.facing === 'left' ? Math.PI : 0;
          if (attack.dir === 'up') angle = -Math.PI / 2;
          else if (attack.dir === 'down') angle = Math.PI / 2;

          enemy.takeDamage(attack.damage, angle, this.particles, this.sound, this.camera);
          hitRegistered = true;

          // Trigger hit freeze pause
          this.hitFreezeTimer = enemy.type === 'boss' ? 0.08 : 0.06;

          // Gain Soul on hit!
          this.player.addSoul(11);
          this.particles.spawnSoulAbsorb(enemy.x + enemy.width/2, enemy.y + enemy.height/2, this.player);
        }
      });

      // Recoil kickback on Player on successful hits
      if (hitRegistered) {
        if (attack.dir === 'down') {
          // Bounce player upward (pogo jump) and reset dash/double jump!
          this.player.vy = this.player.recoilSpeedY;
          this.player.canDoubleJump = true;
          this.player.hasDash = true;
          this.player.recoilTimer = 0; // Clear normal recoil lock
        } else {
          // Apply horizontal recoil lock
          this.player.recoilTimer = this.player.recoilTime;
        }
      }
      this.player.wantsAttackCollide = null;
    }

    // 7. Check Enemy Contact Damage on Player
    if (this.player.invincibilityTimer <= 0 && !this.player.isDead) {
      this.enemies.forEach(enemy => {
        if (!enemy.isDead && this.isRectOverlapping(this.player, enemy)) {
          this.player.takeDamage(enemy.damage, this.sound, this.particles, this.camera);
        }
      });
    }

    // 8. Room Transition Gates Trigger
    const room = this.level.currentRoom;
    room.gates.forEach(gate => {
      // If Boss active in Room 2, lock arena gates!
      if (this.level.currentRoomIndex === 2 && this.activeBoss && !this.activeBoss.isDead) {
        return; // Gate locked!
      }

      if (this.isRectOverlapping(this.player, gate)) {
        this.loadRoom(gate.targetRoom, gate.spawnX, gate.spawnY);
      }
    });

    // 9. Tablets Lore Reading Trigger
    room.tablets.forEach(tab => {
      if (this.isRectOverlapping(this.player, { x: tab.x, y: tab.y, width: 30, height: 45 })) {
        // Prompt player (interact keys)
        if (this.input.wasPressed('interact')) {
          this.triggerDialogue(tab.text);
        }
      }
    });

    // 10. Monarch Wings Upgrade Pickup Collision
    if (this.monarchWingsPickup && this.isRectOverlapping(this.player, this.monarchWingsPickup)) {
      this.player.doubleJumpUnlocked = true;
      this.monarchWingsPickup = null;
      this.sound.playHeal();
      this.triggerDialogue("MONARCH WINGS CLAIMED! Pressed JUMP [Space/C] in mid-air to trigger a Double Jump.");
    }

    // 11. Game Over Death Failsafe
    if (this.player.isDead) {
      this.gameOverDelay += deltaTime;
      if (this.gameOverDelay >= 1.5) {
        this.state = 'GAMEOVER';
        this.ui.showScreen('gameOverScreen');
        this.gameOverDelay = 0;
      }
    }
  }

  updateDialogue(deltaTime) {
    this.closeDialogueCooldown -= deltaTime;
    // Close dialogue box
    if (this.input.wasPressed('interact') && this.closeDialogueCooldown <= 0) {
      this.state = 'PLAYING';
      this.ui.hideDialogue();
    }
  }

  triggerDialogue(text) {
    this.state = 'DIALOGUE';
    this.activeDialogueText = text;
    this.ui.showDialogue(text);
    this.closeDialogueCooldown = 0.5; // Prevent immediate double tap close
  }

  handleBossDefeat(boss) {
    this.activeBoss = null;
    this.sound.playHeal();
    
    // Spawn Monarch Wings Double Jump item in the center of arena
    this.monarchWingsPickup = {
      x: 600,
      y: 400,
      width: 32,
      height: 32
    };

    // Screenshake explosion
    this.camera.shake(20, 800);
  }

  isRectOverlapping(rect1, rect2) {
    return rect1.x < rect2.x + rect2.width &&
           rect1.x + rect1.width > rect2.x &&
           rect1.y < rect2.y + rect2.height &&
           rect1.y + rect1.height > rect2.y;
  }

  draw() {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Apply viewport scale (for crisp pixel coordinates resolution scaling)
    const scale = this.canvas.width / 960;
    this.ctx.save();
    this.ctx.scale(scale, scale);

    // Check states
    if (this.state === 'PLAYING' || this.state === 'DIALOGUE' || this.state === 'PAUSED' || this.state === 'GAMEOVER') {
      const cam = this.camera.getPos();

      // 1. Draw Level Map (Tiles, Benches, background parallax)
      this.level.draw(this.ctx, this.camera, this);

      // 2. Draw Monarch Wings Pickup (if spawned)
      if (this.monarchWingsPickup) {
        this.drawMonarchWingsItem(this.ctx, cam);
      }

      // 3. Draw Shockwaves
      this.ctx.save();
      this.shockwaves.forEach(sw => {
        const sx = sw.x - cam.x;
        const sy = sw.y - cam.y;
        
        // Draw crescent orange shockwave ring
        this.ctx.fillStyle = 'rgba(243, 156, 18, 0.6)';
        this.ctx.shadowBlur = 15;
        this.ctx.shadowColor = '#e67e22';
        
        this.ctx.beginPath();
        this.ctx.ellipse(sx + sw.width/2, sy + sw.height/2, sw.width/2, sw.height/2, 0, 0, Math.PI*2);
        this.ctx.fill();
        
        // Core white streak
        this.ctx.fillStyle = '#ffffff';
        this.ctx.beginPath();
        this.ctx.ellipse(sx + sw.width/2, sy + sw.height/2 + 2, sw.width/3, sw.height/4, 0, 0, Math.PI*2);
        this.ctx.fill();
      });
      this.ctx.restore();

      // 4. Draw Enemies
      this.enemies.forEach(e => e.draw(this.ctx, this.camera, this));

      // 4b. Draw Spell Projectiles
      this.ctx.save();
      this.spells.forEach(sp => {
        const sx = sp.x - cam.x;
        const sy = sp.y - cam.y;
        const lifeRatio = Math.min(1, sp.life / 0.5); // Fade near end of life

        if (sp.type === 'vengefulSpirit') {
          // Glowing cyan skull orb shooting horizontally
          this.ctx.shadowBlur = 24;
          this.ctx.shadowColor = '#5dade2';
          const grad = this.ctx.createRadialGradient(sx + 10, sy + 10, 2, sx + 10, sy + 10, 14);
          grad.addColorStop(0, `rgba(255, 255, 255, ${lifeRatio})`);
          grad.addColorStop(0.5, `rgba(93, 173, 226, ${lifeRatio * 0.9})`);
          grad.addColorStop(1, `rgba(52, 152, 219, 0)`);
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.arc(sx + 10, sy + 10, 14, 0, Math.PI * 2);
          this.ctx.fill();
          // Bright white core
          this.ctx.fillStyle = `rgba(255,255,255,${lifeRatio})`;
          this.ctx.beginPath();
          this.ctx.arc(sx + 10, sy + 10, 4, 0, Math.PI * 2);
          this.ctx.fill();
        } else if (sp.type === 'desolateDive') {
          // Expanding downward blue-cyan shockwave ring
          const alpha = Math.min(1, sp.life * 2.5);
          this.ctx.shadowBlur = 30;
          this.ctx.shadowColor = '#1abc9c';
          this.ctx.strokeStyle = `rgba(26, 188, 156, ${alpha})`;
          this.ctx.lineWidth = 5;
          this.ctx.beginPath();
          this.ctx.ellipse(sx + sp.width / 2, sy + sp.height / 2, sp.width / 2, sp.height / 3, 0, 0, Math.PI * 2);
          this.ctx.stroke();
          this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
          this.ctx.fill();
        } else if (sp.type === 'howlingWraiths') {
          // Upward expanding white-purple cone burst
          const alpha = Math.min(1, sp.life * 3.0);
          this.ctx.shadowBlur = 40;
          this.ctx.shadowColor = '#9b59b6';
          const grad = this.ctx.createRadialGradient(sx + sp.width/2, sy + sp.height, 5, sx + sp.width/2, sy, sp.height);
          grad.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
          grad.addColorStop(0.4, `rgba(155, 89, 182, ${alpha * 0.7})`);
          grad.addColorStop(1, `rgba(155, 89, 182, 0)`);
          this.ctx.fillStyle = grad;
          this.ctx.beginPath();
          this.ctx.ellipse(sx + sp.width / 2, sy + sp.height / 2, sp.width / 2, sp.height / 2, 0, 0, Math.PI * 2);
          this.ctx.fill();
        }
      });
      this.ctx.restore();

      // 5. Draw Player
      if (this.player) {
        this.player.draw(this.ctx, this.camera, this);
      }

      // 6. Draw Particle System
      this.particles.draw(this.ctx, this.camera);


      // --- Draw Dynamic Lighting Mask ---
      this.drawLightingMask(this.ctx, cam);

      // 7. Draw HUD (masks, soul, geo, boss hp)
      this.ui.drawHUD(this.ctx, this.player, this.activeBoss, this.camera);
    }

    this.ctx.restore();
  }

  drawLightingMask(ctx, cam) {
    const lCtx = this.lightCtx;
    
    // Clear light canvas
    lCtx.clearRect(0, 0, 960, 540);

    // Dark ambient fog (much lighter to keep the world visible)
    let ambientColor = 'rgba(6, 8, 18, 0.55)';
    if (this.level.currentRoomIndex === 1) {
      ambientColor = 'rgba(4, 6, 14, 0.60)';
    } else if (this.level.currentRoomIndex === 2) {
      ambientColor = 'rgba(3, 3, 7, 0.65)';
    }

    lCtx.fillStyle = ambientColor;
    lCtx.fillRect(0, 0, 960, 540);

    // Set carve-out mode
    lCtx.globalCompositeOperation = 'destination-out';

    // 1. Player light source (warm white/blue, glows when focusing)
    if (this.player) {
      const px = this.player.x + this.player.width / 2 - cam.x;
      const py = this.player.y + this.player.height / 2 - cam.y;
      
      let radius = 180;
      if (this.player.isFocusing) {
        radius = 260 + Math.random() * 15;
      } else if (this.player.isDashing) {
        radius = 220;
      }

      const grad = lCtx.createRadialGradient(px, py, 15, px, py, radius);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      lCtx.fillStyle = grad;
      lCtx.beginPath();
      lCtx.arc(px, py, radius, 0, Math.PI * 2);
      lCtx.fill();
    }

    // 2. Benches light sources
    const room = this.level.currentRoom;
    room.benches.forEach(bench => {
      const bx = bench.x + bench.width / 2 - cam.x;
      const by = bench.y + 10 - cam.y;
      
      const grad = lCtx.createRadialGradient(bx, by, 15, bx, by, 150);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lCtx.fillStyle = grad;
      lCtx.beginPath();
      lCtx.arc(bx, by, 150, 0, Math.PI * 2);
      lCtx.fill();
    });

    // 3. Lore Tablets light sources
    room.tablets.forEach(tab => {
      const tx = tab.x + 15 - cam.x;
      const ty = tab.y + 22 - cam.y;

      const grad = lCtx.createRadialGradient(tx, ty, 5, tx, ty, 75);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.5)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lCtx.fillStyle = grad;
      lCtx.beginPath();
      lCtx.arc(tx, ty, 75, 0, Math.PI * 2);
      lCtx.fill();
    });

    // 4. Destructible Geo Rocks (subtle gold glow)
    room.geoRocks.forEach(rock => {
      if (rock.isBroken) return;
      const rx = rock.x + 20 - cam.x;
      const ry = rock.y + 20 - cam.y;

      const grad = lCtx.createRadialGradient(rx, ry, 5, rx, ry, 55);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lCtx.fillStyle = grad;
      lCtx.beginPath();
      lCtx.arc(rx, ry, 55, 0, Math.PI * 2);
      lCtx.fill();
    });

    // 5. Bioluminescent Plants (soft blue glow in room 1)
    if (this.level.currentRoomIndex === 1) {
      const pulse = 0.5 + Math.sin(this.level.pulseTime * 2) * 0.25;
      const plantLocations = [
        { x: 380, y: 550 },
        { x: 670, y: 710 },
        { x: 1300, y: 750 },
        { x: 1720, y: 430 }
      ];

      plantLocations.forEach(p => {
        const px = p.x - cam.x;
        const py = p.y - cam.y;
        const rad = 70 * (0.8 + 0.2 * pulse);

        const grad = lCtx.createRadialGradient(px, py - 10, 5, px, py - 10, rad);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
        grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.6)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

        lCtx.fillStyle = grad;
        lCtx.beginPath();
        lCtx.arc(px, py - 10, rad, 0, Math.PI * 2);
        lCtx.fill();
      });
    }

    // 6. Monarch Wings pickup (glowing cyan orb)
    if (this.monarchWingsPickup) {
      const mx = this.monarchWingsPickup.x + 16 - cam.x;
      const my = this.monarchWingsPickup.y + 16 - cam.y;
      
      const grad = lCtx.createRadialGradient(mx, my, 5, mx, my, 85);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
      grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.7)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      lCtx.fillStyle = grad;
      lCtx.beginPath();
      lCtx.arc(mx, my, 85, 0, Math.PI * 2);
      lCtx.fill();
    }

    // Reset composite mode
    lCtx.globalCompositeOperation = 'source-over';

    // Apply soft vignette gradient (subtler)
    const vigGrad = lCtx.createRadialGradient(480, 270, 320, 480, 270, 580);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(3, 5, 10, 0.35)');
    lCtx.fillStyle = vigGrad;
    lCtx.fillRect(0, 0, 960, 540);

    // Draw the lighting mask on the main screen context
    ctx.drawImage(this.lightCanvas, 0, 0);
  }

  drawMonarchWingsItem(ctx, cam) {
    const mx = this.monarchWingsPickup.x - cam.x;
    const my = this.monarchWingsPickup.y - cam.y;
    const t = Date.now() * 0.003;

    ctx.save();
    // Floating bounce
    ctx.translate(mx + 16, my + 16 + Math.sin(t * 2) * 5);
    
    // Draw glowing double wings symbol (blue-cyan color)
    ctx.strokeStyle = '#5dedf8';
    ctx.fillStyle = 'rgba(93, 237, 248, 0.3)';
    ctx.lineWidth = 2;
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#5dedf8';

    // Left Wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-15, -15, -18, -4);
    ctx.quadraticCurveTo(-10, 5, 0, 0);
    ctx.fill(); ctx.stroke();

    // Right Wing
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(15, -15, 18, -4);
    ctx.quadraticCurveTo(10, 5, 0, 0);
    ctx.fill(); ctx.stroke();

    // Glowing core orb
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -2, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}
export default Game;
