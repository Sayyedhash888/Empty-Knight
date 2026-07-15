export class ParticleSystem {
  constructor() {
    this.particles = [];
    this.slashes = [];
    this.geos = [];
    
    // Timer for ambient spore spawning
    this.sporeTimer = 0;
  }

  update(deltaTime, player, level) {
    // 1. Update general particles (spores, dust, hit sparks, etc.)
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= deltaTime;
      
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }

      // Spore custom behavior: drift horizontally like a gentle breeze
      if (p.type === 'spore') {
        p.sinTime += deltaTime * p.sinSpeed;
        p.vx = p.baseVx + Math.sin(p.sinTime) * 15;
      }

      // Physics/movement
      p.x += p.vx * deltaTime;
      p.y += p.vy * deltaTime;
      
      if (p.gravity) {
        p.vy += p.gravity * deltaTime;
      }
      
      if (p.drag) {
        p.vx *= Math.pow(p.drag, deltaTime * 60);
        p.vy *= Math.pow(p.drag, deltaTime * 60);
      }
    }

    // 2. Update nail slash arcs
    for (let i = this.slashes.length - 1; i >= 0; i--) {
      const s = this.slashes[i];
      s.life -= deltaTime;
      if (s.life <= 0) {
        this.slashes.splice(i, 1);
      }
    }

    // 3. Update Geo coins (with floor collision and vacuum physics)
    const pCenterX = player.x + player.width / 2;
    const pCenterY = player.y + player.height / 2;
    const tileSize = level.tileSize;

    for (let i = this.geos.length - 1; i >= 0; i--) {
      const g = this.geos[i];
      
      g.life -= deltaTime;
      if (g.life <= 0) {
        this.geos.splice(i, 1);
        continue;
      }

      const dx = pCenterX - g.x;
      const dy = pCenterY - g.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 150) {
        g.isVacuum = true;
      }

      if (g.isVacuum) {
        const speed = 400;
        g.vx += (dx / dist) * speed * deltaTime * 3;
        g.vy += (dy / dist) * speed * deltaTime * 3;
        
        const currentSpeed = Math.sqrt(g.vx * g.vx + g.vy * g.vy);
        if (currentSpeed > 600) {
          g.vx = (g.vx / currentSpeed) * 600;
          g.vy = (g.vy / currentSpeed) * 600;
        }

        g.x += g.vx * deltaTime;
        g.y += g.vy * deltaTime;

        if (dist < 15) {
          player.collectGeo(g.value);
          this.geos.splice(i, 1);
          continue;
        }
      } else {
        g.vy += 600 * deltaTime;
        
        g.x += g.vx * deltaTime;
        const col = Math.floor(g.x / tileSize);
        const row = Math.floor(g.y / tileSize);
        if (level.getTile(row, col) === 1) {
          g.x -= g.vx * deltaTime;
          g.vx = -g.vx * 0.6;
        }

        g.y += g.vy * deltaTime;
        const nextCol = Math.floor(g.x / tileSize);
        const nextRow = Math.floor(g.y / tileSize);
        if (level.getTile(nextRow, nextCol) === 1) {
          g.y -= g.vy * deltaTime;
          g.vy = -g.vy * 0.5;
          g.vx *= 0.8;
        }
      }
    }
  }

  // Spawn background floating spores in view area
  updateAmbientSpores(deltaTime, camera, roomIndex) {
    this.sporeTimer -= deltaTime;
    
    // Keep a maximum of 40 active spores on screen
    const activeSporesCount = this.particles.filter(p => p.type === 'spore').length;
    
    if (activeSporesCount < 40 && this.sporeTimer <= 0) {
      this.sporeTimer = Math.random() * 0.15 + 0.05; // Quick spawn rate

      const cam = camera.getPos();
      
      // Determine spore colors depending on room
      // Dirtmouth: soft white, Crossroads: cyan-blue, Boss: orange/pale yellow
      let sporeColor = 'rgba(235, 245, 255, ';
      let glowColor = '#d6eaf8';
      if (roomIndex === 1) {
        sporeColor = 'rgba(77, 182, 235, ';
        glowColor = '#4db6eb';
      } else if (roomIndex === 2) {
        sporeColor = 'rgba(243, 156, 18, ';
        glowColor = '#f39c12';
      }

      const maxLife = Math.random() * 8 + 4; // Long lived spores (4-12 seconds)
      
      this.particles.push({
        type: 'spore',
        // Spawn slightly offscreen left/right/bottom to float in
        x: cam.x + Math.random() * (camera.viewportWidth + 80) - 40,
        y: cam.y + Math.random() * (camera.viewportHeight + 80) - 40,
        baseVx: (Math.random() * 15 - 7.5),
        vx: 0,
        vy: -(Math.random() * 20 + 8), // Float upwards
        life: maxLife,
        maxLife: maxLife,
        size: Math.random() * 2.8 + 1.2,
        sinTime: Math.random() * 10,
        sinSpeed: Math.random() * 2 + 1,
        color: sporeColor,
        glowColor: glowColor
      });
    }
  }

  draw(ctx, camera) {
    const cam = camera.getPos();
    
    // --- Draw Geo Coins ---
    this.geos.forEach(g => {
      ctx.save();
      ctx.translate(g.x - cam.x, g.y - cam.y);
      
      const scale = 1 + Math.sin(Date.now() * 0.02) * 0.15;
      ctx.scale(scale, scale);

      ctx.beginPath();
      ctx.moveTo(0, -5);
      ctx.lineTo(4, 0);
      ctx.lineTo(0, 5);
      ctx.lineTo(-4, 0);
      ctx.closePath();

      ctx.fillStyle = g.value >= 5 ? '#e5c158' : '#f5e49b';
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#d4af37';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(-1, -1, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      ctx.restore();
    });

    // --- Draw General Particles (spores first as they are in background) ---
    this.particles.forEach(p => {
      ctx.save();
      ctx.translate(p.x - cam.x, p.y - cam.y);
      
      const lifeRatio = p.life / p.maxLife;

      if (p.type === 'spore') {
        // Floating glowing spores
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color + (lifeRatio * 0.75) + ')';
        ctx.shadowBlur = 8;
        ctx.shadowColor = p.glowColor;
        ctx.fill();
      }
      else if (p.type === 'dust') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * (0.3 + 0.7 * lifeRatio), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(180, 200, 220, ${0.15 * lifeRatio})`;
        ctx.fill();
      } 
      else if (p.type === 'spark') {
        ctx.beginPath();
        const angle = Math.atan2(p.vy, p.vx);
        const length = p.length * lifeRatio;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * length, Math.sin(angle) * length);
        ctx.strokeStyle = `rgba(255, 255, 255, ${lifeRatio * 0.9})`;
        ctx.lineWidth = p.width;
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#ffffff';
        ctx.stroke();
      }
      else if (p.type === 'soul_absorb') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.8 * lifeRatio})`;
        ctx.shadowBlur = 12;
        ctx.shadowColor = '#ffffff';
        ctx.fill();
      }
      else if (p.type === 'healing_ring') {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * (1 - lifeRatio), 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${lifeRatio * 0.45})`;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#ffffff';
        ctx.stroke();
      }

      ctx.restore();
    });

    // --- Draw Nail Slash Arcs ---
    this.slashes.forEach(s => {
      ctx.save();
      ctx.translate(s.x - cam.x, s.y - cam.y);

      const t = 1 - (s.life / s.maxLife);
      const size = s.size;
      const angleOffset = s.angle;

      ctx.rotate(angleOffset);

      ctx.beginPath();
      const startAngle = -Math.PI / 3;
      const endAngle = Math.PI / 3;
      const currentEndAngle = startAngle + (endAngle - startAngle) * t;

      ctx.arc(0, 0, size, startAngle, currentEndAngle);
      
      ctx.strokeStyle = `rgba(255, 255, 255, ${Math.sin(Math.PI * t) * 0.8})`;
      ctx.lineWidth = 15 * Math.sin(Math.PI * t);
      ctx.lineCap = 'round';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#e0f0ff';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, size, startAngle, currentEndAngle);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3 * Math.sin(Math.PI * t);
      ctx.stroke();

      ctx.restore();
    });
  }

  /* --- Spawners --- */

  spawnDust(x, y, vxRange = 20, vyRange = 20, count = 1) {
    for (let i = 0; i < count; i++) {
      const maxLife = Math.random() * 0.4 + 0.2;
      this.particles.push({
        type: 'dust',
        x: x + (Math.random() * 10 - 5),
        y: y + (Math.random() * 4 - 2),
        vx: (Math.random() * 2 - 1) * vxRange,
        vy: (Math.random() * 2 - 1) * vyRange - 5,
        life: maxLife,
        maxLife: maxLife,
        size: Math.random() * 8 + 4,
        drag: 0.95
      });
    }
  }

  spawnLandDust(x, y, count = 6) {
    for (let i = 0; i < count; i++) {
      const maxLife = Math.random() * 0.3 + 0.25;
      const direction = i % 2 === 0 ? 1 : -1;
      this.particles.push({
        type: 'dust',
        x: x,
        y: y,
        vx: direction * (Math.random() * 60 + 30),
        vy: -Math.random() * 15,
        life: maxLife,
        maxLife: maxLife,
        size: Math.random() * 10 + 5,
        drag: 0.92
      });
    }
  }

  spawnHitSparks(x, y, directionAngle = 0, count = 12) {
    for (let i = 0; i < count; i++) {
      const maxLife = Math.random() * 0.15 + 0.1;
      const angle = directionAngle + (Math.random() * 1.2 - 0.6);
      const speed = Math.random() * 300 + 150;
      this.particles.push({
        type: 'spark',
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: maxLife,
        maxLife: maxLife,
        length: Math.random() * 20 + 10,
        width: Math.random() * 2 + 1,
        drag: 0.93,
        gravity: 200
      });
    }
  }

  spawnSoulAbsorb(x, y, targetPlayer) {
    const maxLife = 0.5;
    this.particles.push({
      type: 'soul_absorb',
      x: x,
      y: y,
      vx: (Math.random() * 2 - 1) * 80,
      vy: -Math.random() * 120 - 40,
      life: maxLife,
      maxLife: maxLife,
      size: Math.random() * 3 + 2,
      gravity: 0,
      update: function(dt) {
        const dx = (targetPlayer.x + targetPlayer.width / 2) - this.x;
        const dy = (targetPlayer.y + targetPlayer.height / 2) - this.y;
        this.x += dx * dt * 8;
        this.y += dy * dt * 8;
      }
    });
  }

  spawnHealingAura(player) {
    const maxLife = 0.6;
    const px = player.x + player.width / 2;
    const py = player.y + player.height / 2;
    
    this.particles.push({
      type: 'healing_ring',
      x: px,
      y: py,
      vx: 0, vy: 0,
      radius: Math.random() * 25 + 25,
      life: maxLife,
      maxLife: maxLife
    });

    for (let i = 0; i < 2; i++) {
      this.particles.push({
        type: 'soul_absorb',
        x: px + (Math.random() * 30 - 15),
        y: py + (Math.random() * 30 - 15),
        vx: (Math.random() * 2 - 1) * 10,
        vy: -Math.random() * 25 - 15,
        life: Math.random() * 0.4 + 0.2,
        maxLife: 0.6,
        size: Math.random() * 2 + 1,
        drag: 0.98
      });
    }
  }

  spawnSlash(x, y, dirCode, size = 48) {
    let angle = 0;
    if (dirCode === 'left') angle = Math.PI;
    else if (dirCode === 'up') angle = -Math.PI / 2;
    else if (dirCode === 'down') angle = Math.PI / 2;

    this.slashes.push({
      x: x,
      y: y,
      angle: angle,
      life: 0.12,
      maxLife: 0.12,
      size: size
    });
  }

  spawnGeo(x, y, minVal = 1, maxVal = 4) {
    const count = Math.floor(Math.random() * (maxVal - minVal + 1)) + minVal;
    
    for (let i = 0; i < count; i++) {
      const value = Math.random() < 0.2 ? 5 : 1;
      const angle = -Math.PI / 2 + (Math.random() * 1.5 - 0.75);
      const speed = Math.random() * 200 + 100;

      this.geos.push({
        x: x,
        y: y - 5,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 15.0,
        maxLife: 15.0,
        value: value,
        isVacuum: false
      });
    }
  }

  spawnSpellCast(x, y, type, facing) {
    const count = type === 'desolateDive' ? 24 : 12;
    const color = type === 'howlingWraiths' ? '#9b59b6' : type === 'desolateDive' ? '#1abc9c' : '#3498db';
    
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 120 + 80;
      
      this.particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        size: Math.random() * 4 + 2,
        color: color,
        life: 0.4 + Math.random() * 0.2,
        maxLife: 0.6,
        glow: true,
        drag: 0.94
      });
    }
  }
}
export default ParticleSystem;
