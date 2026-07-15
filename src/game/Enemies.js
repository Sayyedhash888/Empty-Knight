import { Physics } from './Physics.js';

export class Enemy {
  constructor(x, y, width, height, maxHp, damage, type) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.vx = 0;
    this.vy = 0;
    
    this.hp = maxHp;
    this.maxHp = maxHp;
    this.damage = damage;
    this.type = type; // 'crawlid', 'vengefly', 'boss'

    this.onGround = false;
    this.facing = 'left';
    this.hurtTimer = 0;
    this.recoilTimer = 0;
    this.recoilVx = 0;
    
    this.isDead = false;
  }

  updatePhysics(deltaTime, level) {
    // Basic gravity for ground-based enemies
    if (this.type !== 'vengefly') {
      this.vy += 1200 * deltaTime;
      this.vy = Math.min(600, this.vy);
    }
    
    // Recoil dampening
    if (this.recoilTimer > 0) {
      this.recoilTimer -= deltaTime;
      this.vx = this.recoilVx;
      if (this.recoilTimer <= 0) {
        this.vx = 0;
      }
    }

    Physics.checkCollisions(this, level, deltaTime);
  }

  takeDamage(amount, directionAngle, particles, sound, camera) {
    if (this.isDead) return;

    this.hp -= amount;
    this.hurtTimer = 0.15;
    
    // Apply recoil knockback opposite to the attack direction angle
    this.recoilTimer = 0.12;
    const knockbackForce = this.type === 'boss' ? 80 : 180;
    this.recoilVx = Math.cos(directionAngle) * knockbackForce;

    sound.playHit();
    camera.shake(this.type === 'boss' ? 10 : 5, 150);

    // Spawn oil/dust blood droplets
    const px = this.x + this.width / 2;
    const py = this.y + this.height / 2;
    particles.spawnHitSparks(px, py, directionAngle + Math.PI, this.type === 'boss' ? 12 : 5);

    if (this.hp <= 0) {
      this.isDead = true;
      sound.playHurt();
      // Drop Geo
      const geoCountMin = this.type === 'boss' ? 30 : 2;
      const geoCountMax = this.type === 'boss' ? 45 : 5;
      particles.spawnGeo(px, py, geoCountMin, geoCountMax);
    }
  }
}

// 1. Crawlid - Simple Crawling Beetle
export class Crawlid extends Enemy {
  constructor(x, y) {
    super(x, y, 32, 24, 2, 1, 'crawlid');
    this.speed = 50;
    this.vx = -this.speed;
  }

  update(deltaTime, player, level, particles, sound, camera) {
    if (this.isDead) return;

    // Tick hurt timer
    if (this.hurtTimer > 0) this.hurtTimer -= deltaTime;

    if (this.recoilTimer <= 0) {
      // Crawl back and forth
      this.vx = this.facing === 'left' ? -this.speed : this.speed;

      // Turn around if colliding with walls
      if (this.vx < 0 && this.onWallLeft) {
        this.facing = 'right';
      } else if (this.vx > 0 && this.onWallRight) {
        this.facing = 'left';
      }

      // Turn around if about to fall off ledges
      const checkX = this.facing === 'left' ? this.x - 4 : this.x + this.width + 4;
      const checkY = this.y + this.height + 4;
      if (this.onGround && !level.isPositionSolid(checkX, checkY)) {
        this.facing = this.facing === 'left' ? 'right' : 'left';
      }
    }

    this.updatePhysics(deltaTime, level);
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    const cam = camera.getPos();
    const cx = this.x - cam.x;
    const cy = this.y - cam.y;

    ctx.save();
    
    // Apply hurt flash (whiten/flicker)
    if (this.hurtTimer > 0) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
    }

    // Crawlid Shell Body
    ctx.fillStyle = '#4a2810'; // Brown
    ctx.strokeStyle = '#1b0e06';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(cx, cy, this.width, this.height, 6);
    ctx.fill();
    ctx.stroke();

    // Mask face
    ctx.fillStyle = '#eaeaea';
    ctx.beginPath();
    if (this.facing === 'left') {
      ctx.roundRect(cx, cy + 4, 10, 16, 4);
    } else {
      ctx.roundRect(cx + this.width - 10, cy + 4, 10, 16, 4);
    }
    ctx.fill();
    ctx.stroke();

    // Eyes
    ctx.fillStyle = '#0f0502';
    ctx.beginPath();
    if (this.facing === 'left') {
      ctx.arc(cx + 4, cy + 12, 1.5, 0, Math.PI * 2);
    } else {
      ctx.arc(cx + this.width - 4, cy + 12, 1.5, 0, Math.PI * 2);
    }
    ctx.fill();

    // Tiny legs
    ctx.strokeStyle = '#1b0e06';
    ctx.lineWidth = 2;
    const legSwing = Math.sin(Date.now() * 0.015) * 4;
    ctx.beginPath();
    for (let i = 4; i < this.width - 4; i += 8) {
      ctx.moveTo(cx + i, cy + this.height);
      ctx.lineTo(cx + i + legSwing, cy + this.height + 4);
    }
    ctx.stroke();

    ctx.restore();
  }
}

// 2. Vengefly - Aggro Flying Insect
export class Vengefly extends Enemy {
  constructor(x, y) {
    super(x, y, 28, 28, 2, 1, 'vengefly');
    this.startX = x;
    this.startY = y;
    this.speed = 100;
    this.isAggro = false;
    this.shriekTimer = 0;
  }

  update(deltaTime, player, level, particles, sound, camera) {
    if (this.isDead) return;

    if (this.hurtTimer > 0) this.hurtTimer -= deltaTime;

    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // Aggro detection
    if (!this.isAggro && dist < 220) {
      this.isAggro = true;
      this.shriekTimer = 0.4; // Screen shriek lock
      sound.playJump(); // Play shriek pitch
      camera.shake(3, 200);
    }

    if (this.isAggro) {
      if (this.shriekTimer > 0) {
        this.shriekTimer -= deltaTime;
        this.vx = 0;
        this.vy = 0;
      } else {
        // Chase player
        this.vx = (dx / dist) * this.speed;
        this.vy = (dy / dist) * this.speed;
        this.facing = this.vx < 0 ? 'left' : 'right';
      }
    } else {
      // Hover bobbing in place
      this.vx = 0;
      this.vy = Math.sin(Date.now() * 0.005) * 15;
    }

    if (this.recoilTimer <= 0) {
      this.x += this.vx * deltaTime;
      this.y += this.vy * deltaTime;
    } else {
      // Push back
      this.x += this.vx * deltaTime;
      this.y += this.vy * deltaTime;
      this.vx *= 0.9;
      this.vy *= 0.9;
    }

    // Wall collision (rebound)
    const bounds = Physics.getEntityTileBounds(this, level);
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        if (level.getTile(r, c) === 1) {
          // Bounce off walls
          this.x -= this.vx * deltaTime;
          this.y -= this.vy * deltaTime;
          this.vx = -this.vx * 0.5;
          this.vy = -this.vy * 0.5;
        }
      }
    }
  }

  draw(ctx, camera) {
    if (this.isDead) return;
    const cam = camera.getPos();
    const fx = this.x - cam.x;
    const fy = this.y - cam.y;

    ctx.save();
    
    if (this.hurtTimer > 0) {
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#ffffff';
    }

    // Wing Flapping (draw first behind body)
    const flap = Math.sin(Date.now() * 0.06) * 10;
    ctx.strokeStyle = '#eef3f7';
    ctx.fillStyle = 'rgba(230, 240, 250, 0.4)';
    ctx.lineWidth = 1.5;
    
    ctx.beginPath();
    ctx.ellipse(fx + 10, fy + flap - 2, 5, 12, -Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(fx + 18, fy + flap - 2, 5, 12, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Vengefly Body
    ctx.fillStyle = '#2c3e50';
    ctx.strokeStyle = '#0f171e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(fx + this.width / 2, fy + this.height / 2, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Big insect eyes
    ctx.fillStyle = '#eaeaea';
    ctx.beginPath();
    if (this.facing === 'left') {
      ctx.arc(fx + 8, fy + 10, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#eaeaea'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a62d2d'; // red pupil
      ctx.beginPath();
      ctx.arc(fx + 6, fy + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.arc(fx + 20, fy + 10, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#eaeaea'; ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#a62d2d';
      ctx.beginPath();
      ctx.arc(fx + 22, fy + 10, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Stinger bottom
    ctx.fillStyle = '#111822';
    ctx.beginPath();
    ctx.moveTo(fx + 12, fy + 22);
    ctx.lineTo(fx + 16, fy + 22);
    ctx.lineTo(fx + 14, fy + 27);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }
}

// 3. False Knight - Boss Arena Fight!
export class FalseKnight extends Enemy {
  constructor(x, y) {
    // 90px wide x 110px tall, 15 hits (HP), does 1 damage
    super(x, y, 90, 110, 15, 1, 'boss');
    this.speed = 85;
    this.jumpTimer = 2.0;
    this.attackTimer = 1.0;
    
    this.state = 'idle'; // 'idle', 'jumping', 'attacking', 'enraged'
    this.stateTimer = 0;
    
    // Mace details
    this.maceX = 0;
    this.maceY = 0;
    this.maceState = 'holding'; // 'holding', 'slamming', 'recovering'
    this.maceRadius = 22;
  }

  update(deltaTime, player, level, particles, sound, camera) {
    if (this.isDead) {
      // Explode on death!
      if (Math.random() < 0.2) {
        particles.spawnHitSparks(this.x + Math.random() * this.width, this.y + Math.random() * this.height, Math.random()*Math.PI*2, 3);
      }
      this.updatePhysics(deltaTime, level);
      return;
    }

    if (this.hurtTimer > 0) this.hurtTimer -= deltaTime;

    const dx = player.x - this.x;
    this.facing = dx < 0 ? 'left' : 'right';

    // State Machine
    this.stateTimer += deltaTime;
    this.attackTimer -= deltaTime;
    this.jumpTimer -= deltaTime;

    if (this.state === 'idle') {
      this.vx = 0;
      
      // Decisions
      if (this.attackTimer <= 0 && Math.abs(dx) < 180) {
        // Slam attack!
        this.state = 'attacking';
        this.stateTimer = 0;
        this.maceState = 'slamming';
      } 
      else if (this.jumpTimer <= 0) {
        // Leap jump
        this.state = 'jumping';
        this.stateTimer = 0;
        this.vy = -500;
        this.vx = this.facing === 'left' ? -250 : 250;
        this.onGround = false;
      }
    }
    else if (this.state === 'jumping') {
      if (this.onGround) {
        this.state = 'idle';
        this.vx = 0;
        this.jumpTimer = Math.random() * 2.0 + 1.2;
        sound.playHit(); // Heavy landing shake
        camera.shake(8, 200);
        // Create land dust puff
        particles.spawnLandDust(this.x + this.width/2, this.y + this.height, 8);
      }
    }
    else if (this.state === 'attacking') {
      this.vx = 0;
      
      // Perform slam at midpoint of attack state (0.4s)
      if (this.maceState === 'slamming' && this.stateTimer >= 0.4) {
        this.maceState = 'recovering';
        
        // Mace slam hits ground!
        sound.playHit();
        camera.shake(14, 300);
        
        // Spawn smash impact dust
        const slamX = this.facing === 'left' ? this.x - 30 : this.x + this.width + 30;
        particles.spawnLandDust(slamX, this.y + this.height, 12);
        
        // Generate Shockwave Entity!
        this.spawnShockwave = {
          x: slamX,
          y: this.y + this.height - 20,
          vx: this.facing === 'left' ? -200 : 200,
          width: 32,
          height: 20,
          life: 2.2
        };
      }
      
      if (this.stateTimer >= 0.8) {
        this.state = 'idle';
        this.maceState = 'holding';
        this.attackTimer = Math.random() * 1.5 + 0.8;
      }
    }

    // Apply standard gravity & physics
    this.updatePhysics(deltaTime, level);
  }

  draw(ctx, camera, game) {
    const cam = camera.getPos();
    const bx = this.x - cam.x;
    const by = this.y - cam.y;
    const t = this.stateTimer;

    let bossImg = null;
    if (game && game.processedAssets) {
      if (this.state === 'attacking' && game.processedAssets['falseKnightAttack']) {
        bossImg = game.processedAssets['falseKnightAttack'];
      } else if (this.state === 'jumping' && game.processedAssets['falseKnightLeap']) {
        bossImg = game.processedAssets['falseKnightLeap'];
      } else {
        bossImg = game.processedAssets['falseKnight'];
      }
    }

    if (this.type === 'boss' && bossImg) {
      ctx.save();
      if (this.hurtTimer > 0) {
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#e74c3c';
      }
      // Mirror if facing right
      if (this.facing === 'right') {
        ctx.translate(bx + this.width / 2, by + this.height / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(bx + this.width / 2), -(by + this.height / 2));
      }
      ctx.drawImage(bossImg, bx - 15, by - 25, this.width + 30, this.height + 30);
      ctx.restore();
      return;
    }

    ctx.save();

    if (this.hurtTimer > 0) {
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#e74c3c'; // Glow red
    }

    // Draw Giant Mace (drawn behind or in front depending on slam)
    const drawMace = () => {
      ctx.save();
      
      let mx = bx + (this.facing === 'left' ? -10 : this.width + 10);
      let my = by + 40;
      let rot = this.facing === 'left' ? 0.3 : -0.3;

      if (this.state === 'attacking') {
        if (this.maceState === 'slamming') {
          // Mace rises and swings down
          const angle = t < 0.4 ? (t / 0.4) * (Math.PI * 0.6) : Math.PI * 0.6;
          rot = this.facing === 'left' ? -0.5 + angle : 0.5 - angle;
        } else {
          // Resting on floor
          rot = this.facing === 'left' ? Math.PI * 0.55 : -Math.PI * 0.55;
          mx = bx + (this.facing === 'left' ? -35 : this.width + 35);
          my = by + this.height - 15;
        }
      }

      ctx.translate(mx, my);
      ctx.rotate(rot);

      // Mace handle shaft
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -60);
      ctx.stroke();

      // Mace spiked head
      ctx.fillStyle = '#566573';
      ctx.strokeStyle = '#1b2631';
      ctx.lineWidth = 2.5;
      
      ctx.beginPath();
      ctx.arc(0, -60, this.maceRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Spikes on mace
      ctx.fillStyle = '#85929e';
      ctx.beginPath();
      ctx.moveTo(-this.maceRadius, -60); ctx.lineTo(-this.maceRadius - 8, -60); ctx.lineTo(-this.maceRadius, -56);
      ctx.moveTo(this.maceRadius, -60); ctx.lineTo(this.maceRadius + 8, -60); ctx.lineTo(this.maceRadius, -64);
      ctx.moveTo(0, -60 - this.maceRadius); ctx.lineTo(0, -60 - this.maceRadius - 8); ctx.lineTo(4, -60 - this.maceRadius);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    };

    if (this.state !== 'attacking' || this.maceState === 'slamming') {
      drawMace();
    }

    // False Knight Silhouette Armor
    ctx.fillStyle = '#2e3a4e'; // Steel Dark grey/blue armor
    ctx.strokeStyle = '#0f1520';
    ctx.lineWidth = 3.5;

    // Body armor plates
    ctx.beginPath();
    ctx.roundRect(bx, by + 18, this.width, this.height - 18, 12);
    ctx.fill();
    ctx.stroke();

    // Heavy shoulder pads (pauldrons)
    ctx.fillStyle = '#475b75';
    ctx.beginPath();
    ctx.roundRect(bx - 12, by + 16, 24, 28, 6); // Left
    ctx.roundRect(bx + this.width - 12, by + 16, 24, 28, 6); // Right
    ctx.fill();
    ctx.stroke();

    // Giant Horned Helmet
    ctx.fillStyle = '#eaeaea'; // Heavy metal mask
    ctx.beginPath();
    ctx.moveTo(bx + this.width/2 - 20, by + 16);
    ctx.quadraticCurveTo(bx + this.width/2 - 24, by - 12, bx + this.width/2 - 28, by - 20); // Left Horn
    ctx.quadraticCurveTo(bx + this.width/2 - 15, by - 8, bx + this.width/2 - 10, by);
    ctx.lineTo(bx + this.width/2 + 10, by);
    ctx.quadraticCurveTo(bx + this.width/2 + 15, by - 8, bx + this.width/2 + 28, by - 20); // Right Horn
    ctx.quadraticCurveTo(bx + this.width/2 + 24, by - 12, bx + this.width/2 + 20, by + 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Red glowing visor slot
    ctx.fillStyle = '#e74c3c';
    ctx.beginPath();
    ctx.ellipse(bx + this.width/2, by + 6, 8, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Heavy iron feet
    ctx.fillStyle = '#1c2833';
    ctx.fillRect(bx + 8, by + this.height - 5, 20, 8);
    ctx.fillRect(bx + this.width - 28, by + this.height - 5, 20, 8);

    if (this.state === 'attacking' && this.maceState !== 'slamming') {
      drawMace();
    }

    ctx.restore();
  }
}
export default { Crawlid, Vengefly, FalseKnight };
