import { Physics } from './Physics.js';

export class Player {
  constructor(x, y) {
    // Positioning and Physics
    this.x = x;
    this.y = y;
    this.width = 24;
    this.height = 42;
    this.vx = 0;
    this.vy = 0;

    // Movement Parameters (tuned for responsive Hollow Knight feel)
    this.gravity = 1400;
    this.runSpeed = 220;
    this.acceleration = 1200;
    this.friction = 1400;
    this.jumpForce = -680;      // High jump to clear ~3.5 tiles
    this.doubleJumpForce = -580; // Strong double jump
    this.terminalVelocity = 700;

    // Wall slide / Wall Jump — Hollow Knight style
    this.wallSlideSpeed = 80;       // Slow controlled slide
    this.wallJumpForceX = 320;      // Moderate kick — goes up more than out
    this.wallJumpForceY = -680;     // Same height as normal jump
    this.wallJumpLockTime = 0.20;   // Short enough to chain wall jumps quickly
    this.wallJumpLockTimer = 0;
    this.isWallClinging = false;    // Currently clinging to a wall (visual flag)
    this.wallClingDir = 0;          // Which wall: -1 = left wall, 1 = right wall

    // Dash (Mothwing Cloak)
    this.dashSpeed = 520;
    this.dashDuration = 0.22;
    this.dashCooldownTime = 0.5;
    this.dashTimer = 0;
    this.dashCooldownTimer = 0;
    this.hasDash = true; // Refills on landing

    // Combat
    this.attackCooldown = 0.35;
    this.attackCooldownTimer = 0;
    this.attackDirection = 'right';
    this.nailDamage = 1;
    this.recoilSpeedX = 80;  // Subtle nudge back, not a big fling
    this.recoilSpeedY = 320; // Pogo bounce upward stays strong
    this.recoilTime = 0.05;  // Very brief — just a quick stagger
    this.recoilTimer = 0;
    this.wantsHitFreeze = 0; // Transmit hit freeze requests to Game

    // Spell casting (Vengeful Spirit / Desolate Dive / Howling Wraiths)
    this.spellCooldown = 0.8;
    this.spellCooldownTimer = 0;
    this.wantsCastSpell = null; // Queued spell for Game to spawn

    // Jump state flags
    this.onGround = false;
    this.onWallLeft = false;
    this.onWallRight = false;
    this.facing = 'right'; // 'left' or 'right'
    this.canDoubleJump = false;
    
    // Upgrades
    this.doubleJumpUnlocked = false; // Unlocked after beating the boss!

    // Cheats
    this.godModeActive = false;

    // Coyote Time & Jump Buffering (Hollow Knight buttery responsive physics)
    this.coyoteTimer = 0;
    this.coyoteDuration = 0.09;      // 90ms coyote window
    this.jumpBufferTimer = 0;
    this.jumpBufferDuration = 0.12;  // 120ms input buffer window

    // Stats
    this.maxHealth = 5;
    this.health = 5;
    this.maxSoul = 100;
    this.soul = 0; // Starts at 0
    this.geo = 0;

    // States
    this.isDashing = false;
    this.isFocusing = false;
    this.focusTimer = 0;
    this.focusDuration = 1.0; // Time needed to heal 1 mask
    this.focusSoundPlayed = false;
    this.focusAudioNodes = null; // Store synth nodes to stop them if interrupted

    // Status Timers
    this.invincibilityTimer = 0;
    this.invincibilityDuration = 1.5;
    this.hurtTimer = 0;
    this.isDead = false;

    // Last bench rested at
    this.respawnX = x;
    this.respawnY = y;
    this.respawnRoom = 0;
    this.isSitting = false;
    this.benchRef = null;

    // Visual breathing animation timer
    this.animTime = 0;
  }

  update(deltaTime, input, level, particles, sound, camera) {
    this.animTime += deltaTime;

    // Cheats: God Mode
    this.godModeActive = !!input.godMode;
    if (this.godModeActive) {
      this.health = this.maxHealth;
      this.soul = this.maxSoul;
      this.nailDamage = 5;
    } else {
      this.nailDamage = 1;
    }

    // 1. Tick Timers
    if (this.invincibilityTimer > 0) this.invincibilityTimer -= deltaTime;
    if (this.hurtTimer > 0) this.hurtTimer -= deltaTime;
    if (this.attackCooldownTimer > 0) this.attackCooldownTimer -= deltaTime;
    if (this.spellCooldownTimer > 0) this.spellCooldownTimer -= deltaTime;
    if (this.dashCooldownTimer > 0) this.dashCooldownTimer -= deltaTime;
    if (this.wallJumpLockTimer > 0) this.wallJumpLockTimer -= deltaTime;
    if (this.recoilTimer > 0) this.recoilTimer -= deltaTime;
    if (this.coyoteTimer > 0) this.coyoteTimer -= deltaTime;
    if (this.jumpBufferTimer > 0) this.jumpBufferTimer -= deltaTime;

    if (this.isDead) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // 2. Bench Sitting State
    if (this.isSitting) {
      this.vx = 0;
      this.vy = 0;
      
      // Auto heal slowly on bench
      if (this.health < this.maxHealth && Math.sin(this.animTime * 5) > 0.98) {
        this.health = this.maxHealth;
        particles.spawnHealingAura(this);
      }

      // Stand up if moving or jumping
      if (input.isDown('left') || input.isDown('right') || input.wasPressed('jump')) {
        this.isSitting = false;
        this.benchRef = null;
        this.y -= 10; // Lift up slightly
      }
      return;
    }

    // 3. Spikes and Hazards Check (Self-harm) — completely ignore in God Mode
    if (this.touchingSpikes && !this.godModeActive && this.invincibilityTimer <= 0) {
      this.takeDamage(1, sound, particles, camera);
      if (!this.isDead) {
        // Respawn at last safe bench/ground coordinates
        this.respawnAtLastSafe(level, particles);
      }
      return;
    }

    // 4. Focus (Healing) Logic (cancel if pressing movement keys)
    if (input.isDown('focus') && this.onGround && Math.abs(this.vx) < 10 && this.invincibilityTimer <= 0 && !input.isDown('left') && !input.isDown('right')) {
      if (this.soul >= 33 && this.health < this.maxHealth) {
        this.isFocusing = true;
        this.focusTimer += deltaTime;
        
        // Spawn contraction healing particles
        if (Math.random() < 0.15) {
          particles.spawnHealingAura(this);
        }

        // Start playing focus charge synthesizer sound
        if (!this.focusSoundPlayed) {
          this.focusAudioNodes = sound.playFocusCharge();
          this.focusSoundPlayed = true;
        }

        if (this.focusTimer >= this.focusDuration) {
          // Success Heal!
          this.health++;
          this.soul -= 33;
          this.focusTimer = 0;
          this.isFocusing = false;
          this.focusSoundPlayed = false;
          sound.playHeal();
          particles.spawnHealingAura(this);
          camera.shake(4, 200);

          // Stop focus sound
          this.stopFocusSound();
        }
      } else {
        this.isFocusing = false;
        this.stopFocusSound();
      }
    } else {
      if (this.isFocusing) {
        this.isFocusing = false;
        this.focusTimer = 0;
        this.stopFocusSound();
      }
    }

    // Lock controls during focusing
    if (this.isFocusing) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    // 5. Dash Mechanics
    if (input.wasPressed('dash') && this.dashCooldownTimer <= 0 && this.hasDash && !this.isDashing) {
      this.isDashing = true;
      this.dashTimer = this.dashDuration;
      this.dashCooldownTimer = this.dashCooldownTime;
      this.hasDash = false;
      this.vy = 0; // Freeze vertical speed during dash
      sound.playDash();
      
      // Determine dash direction
      if (input.isDown('left')) this.facing = 'left';
      else if (input.isDown('right')) this.facing = 'right';

      // Dash whoosh particles
      particles.spawnDust(this.x + this.width / 2, this.y + this.height, 80, 10, 4);
    }

    if (this.isDashing) {
      this.dashTimer -= deltaTime;
      this.vx = (this.facing === 'left' ? -this.dashSpeed : this.dashSpeed);
      
      // Spawn trail ghosts/particles
      if (Math.random() < 0.3) {
        particles.spawnDust(this.x + this.width/2, this.y + this.height/2, 20, 20, 1);
      }

      if (this.dashTimer <= 0) {
        this.isDashing = false;
        this.vx *= 0.4; // Soft brake
      }
      
      // Execute Dash physics and early return
      Physics.checkCollisions(this, level, deltaTime);
      return;
    }

    // 6. Running / Horizontal Movement
    const isLunging = this.attackCooldownTimer > this.attackCooldown - 0.12; // 120ms attack lunge horizontal lock
    if (this.recoilTimer <= 0 && !isLunging) { // Lock controls slightly during recoil
      let moveDir = 0;
      if (this.wallJumpLockTimer <= 0) {
        if (input.isDown('left')) {
          moveDir = -1;
          this.facing = 'left';
        }
        if (input.isDown('right')) {
          moveDir = 1;
          this.facing = 'right';
        }
      }

      if (moveDir !== 0) {
        // During wall jump lock, allow acceleration but don't override vx immediately
        if (this.wallJumpLockTimer > 0) {
          // Gently blend toward player direction — Hollow Knight allows some air steering
          this.vx += moveDir * this.acceleration * 0.35 * deltaTime;
        } else {
          this.vx += moveDir * this.acceleration * deltaTime;
        }
        // Clamp to run speed
        this.vx = Math.max(-this.runSpeed, Math.min(this.runSpeed, this.vx));

        // Spawn running dust
        if (this.onGround && Math.sin(this.animTime * 15) > 0.8) {
          particles.spawnDust(this.x + this.width / 2, this.y + this.height, 10, 5, 1);
        }
      } else {
        // Apply friction when not pressing keys
        if (this.onGround) {
          if (this.vx > 0) this.vx = Math.max(0, this.vx - this.friction * deltaTime);
          else if (this.vx < 0) this.vx = Math.min(0, this.vx + this.friction * deltaTime);
        } else {
          // Very low air resistance — preserves wall jump kick momentum
          const airFriction = this.wallJumpLockTimer > 0 ? 0.05 : 0.3;
          if (this.vx > 0) this.vx = Math.max(0, this.vx - (this.friction * airFriction) * deltaTime);
          else if (this.vx < 0) this.vx = Math.min(0, this.vx + (this.friction * airFriction) * deltaTime);
        }
      }
    } else {
      // Recoil pushing player back
      this.vx = (this.facing === 'left' ? this.recoilSpeedX : -this.recoilSpeedX);
    }

    // 7. Gravity & Wall Slide (Hollow Knight: cling on touch, no direction required)
    let isWallSliding = false;
    this.isWallClinging = false;

    // Cling to wall when touching it in the air while falling or stationary vertically
    const touchingLeft = this.onWallLeft;
    const touchingRight = this.onWallRight;

    if (!this.onGround && this.vy >= -50 && (touchingLeft || touchingRight)) {
      // Clinging — slow fall even without pressing into wall
      isWallSliding = true;
      this.isWallClinging = true;
      this.wallClingDir = touchingLeft ? -1 : 1;
      this.vy = Math.min(this.vy, this.wallSlideSpeed); // Cap downward speed

      // Spawn wall dust particles
      if (Math.random() < 0.12) {
        const dustX = touchingLeft ? this.x : this.x + this.width;
        particles.spawnDust(dustX, this.y + this.height * 0.6, 5, 20, 1);
      }
    } else {
      // Normal gravity fall
      this.vy += this.gravity * deltaTime;
      this.vy = Math.min(this.terminalVelocity, this.vy);
    }

    // Refill dash and double jump on landing, reset coyote timer
    if (this.onGround) {
      this.hasDash = true;
      this.canDoubleJump = true;
      this.coyoteTimer = this.coyoteDuration;
    }

    // 8. Jumping Logic
    if (input.wasPressed('jump')) {
      this.jumpBufferTimer = this.jumpBufferDuration;
    }

    if (this.jumpBufferTimer > 0) {
      if (this.onGround || this.coyoteTimer > 0) {
        // Normal Jump (from ground or coyote time window)
        this.vy = this.jumpForce;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        sound.playJump();
        particles.spawnLandDust(this.x + this.width / 2, this.y + this.height, 4);
      } 
      else if (isWallSliding) {
        // Wall Jump: instant strong kick AWAY from wall
        const kickDir = this.onWallLeft ? 1 : -1; // Always kick away from wall
        this.vy = this.wallJumpForceY;
        this.vx = kickDir * this.wallJumpForceX;   // Immediately set full speed, don't blend
        this.wallJumpLockTimer = this.wallJumpLockTime;
        this.facing = kickDir === 1 ? 'right' : 'left';
        this.isWallClinging = false;
        this.hasDash = true;       // Refresh dash on wall jump
        this.canDoubleJump = true; // Refresh double jump on wall jump
        this.jumpBufferTimer = 0;
        sound.playJump();

        // Kick-off dust burst from the wall
        const dustX = this.onWallLeft ? this.x : this.x + this.width;
        particles.spawnDust(dustX, this.y + this.height * 0.5, 60, 12, 5);
        particles.spawnLandDust(this.x + this.width / 2, this.y + this.height * 0.5, 4);
      }
      else if (this.doubleJumpUnlocked && this.canDoubleJump) {
        // Double Jump (Monarch Wings effect!)
        this.vy = this.doubleJumpForce;
        this.canDoubleJump = false;
        this.jumpBufferTimer = 0;
        sound.playJump();

        // Gorgeous wings vapor puff beneath player
        particles.spawnLandDust(this.x + this.width / 2, this.y + this.height, 6);
      }
    }

    // Variable Jump Height: cut velocity short on key release
    if (input.wasReleased('jump') && this.vy < -260) {
      this.vy = -260;
    }

    // 9. Attack (Nail Slashing)
    if (input.wasPressed('attack') && this.attackCooldownTimer <= 0) {
      // If W (focus/spell key) also pressed → cast a spell instead!
      if (input.isDown('focus') && this.spellCooldownTimer <= 0 && this.soul >= 33) {
        this.castSpell(input, particles, sound, camera);
      } else {
        this.attack(input, particles, sound, camera, level);
      }
    }

    // Q key also casts Vengeful Spirit directly
    if (input.wasPressed('spellCast') && this.spellCooldownTimer <= 0 && this.soul >= 33) {
      this.castSpell(input, particles, sound, camera);
    }

    // 10. Bench resting check
    if (this.onGround && input.isDown('down') && Math.abs(this.vx) < 10) {
      const activeBench = level.currentRoom.benches.find(bench => {
        return Physics.isOverlapping(this, bench.x, bench.y, bench.width, bench.height);
      });
      if (activeBench) {
        this.isSitting = true;
        this.benchRef = activeBench;
        this.health = this.maxHealth;
        this.soul = this.maxSoul;
        this.respawnX = activeBench.x + activeBench.width / 2 - this.width / 2;
        this.respawnY = activeBench.y + 12 - this.height;
        this.respawnRoom = level.currentRoomIndex;
        sound.playBenchSit();
        particles.spawnHealingAura(this);
      }
    }

    // Apply physics engine collision resolver
    Physics.checkCollisions(this, level, deltaTime);
  }

  attack(input, particles, sound, camera, level) {
    this.attackCooldownTimer = this.attackCooldown;
    sound.playSlash();

    // Determine direction
    let dir = this.facing;
    if (input.isDown('up')) dir = 'up';
    else if (input.isDown('down') && !this.onGround) dir = 'down';

    this.attackDirection = dir;

    // Apply horizontal step lunge on ground
    if (this.onGround) {
      if (dir === 'left') this.vx = -this.runSpeed * 1.35;
      else if (dir === 'right') this.vx = this.runSpeed * 1.35;
    }

    // Missed attack slight camera vibration for weight
    camera.shake(1.5, 80);

    // Trigger slash animation particle
    const slashRange = 45;
    const px = this.x + this.width / 2;
    const py = this.y + this.height / 2;

    let sx = px + (dir === 'left' ? -slashRange : slashRange);
    let sy = py;

    if (dir === 'up') {
      sx = px;
      sy = py - slashRange;
    } else if (dir === 'down') {
      sx = px;
      sy = py + slashRange;
    }

    particles.spawnSlash(sx, sy, dir, 64); // Increased slash arc size

    // Bounding box for attack collision
    let attackArea = {
      x: px - 25,
      y: py - 25,
      width: 50,
      height: 50
    };

    if (dir === 'left') {
      attackArea.x = this.x - 45;
      attackArea.width = 45;
      attackArea.y = this.y - 5;
      attackArea.height = this.height + 10;
    } else if (dir === 'right') {
      attackArea.x = this.x + this.width;
      attackArea.width = 45;
      attackArea.y = this.y - 5;
      attackArea.height = this.height + 10;
    } else if (dir === 'up') {
      attackArea.x = this.x - 10;
      attackArea.width = this.width + 20;
      attackArea.y = this.y - 45;
      attackArea.height = 45;
    } else if (dir === 'down') {
      attackArea.x = this.x - 10;
      attackArea.width = this.width + 20;
      attackArea.y = this.y + this.height;
      attackArea.height = 45;
    }

    // Check hit against destructible Geo Rocks in the level
    level.currentRoom.geoRocks.forEach(rock => {
      if (!rock.isBroken && Physics.isOverlapping(attackArea, rock.x, rock.y, 40, 40)) {
        rock.hp -= this.nailDamage;
        sound.playHit();
        this.wantsHitFreeze = 0.04;
        particles.spawnHitSparks(rock.x + 20, rock.y + 20, dir === 'left' ? 0 : dir === 'right' ? Math.PI : Math.PI/2, 6);
        camera.shake(6, 120);

        if (rock.hp <= 0) {
          rock.isBroken = true;
          particles.spawnGeo(rock.x + 20, rock.y + 20, rock.value - 2, rock.value + 2);
        }
      }
    });

    // Check hit against Enemies (this will be invoked by the game controller)
    this.wantsAttackCollide = {
      area: attackArea,
      dir: dir,
      damage: this.nailDamage
    };
  }

  castSpell(input, particles, sound, camera) {
    // Determine which spell based on direction held
    let spellType = 'vengefulSpirit'; // Default: horizontal projectile
    if (!this.onGround && input.isDown('down')) {
      spellType = 'desolateDive';    // Down in air: slam downward
    } else if (input.isDown('up')) {
      spellType = 'howlingWraiths'; // Up key: upward burst
    }

    // Deduct Soul cost
    this.soul -= 33;
    this.spellCooldownTimer = this.spellCooldown;

    // Camera micro-shake on cast
    camera.shake(3, 100);
    sound.playSpell(spellType);

    const cx = this.x + this.width / 2;
    const cy = this.y + this.height / 2;

    // Spawn cast burst particles at player
    particles.spawnSpellCast(cx, cy, spellType, this.facing);

    // Queue the spell projectile for Game to spawn
    this.wantsCastSpell = {
      type: spellType,
      x: cx,
      y: cy,
      facing: this.facing,
      damage: 2
    };

    // Desolate Dive: snap player downward
    if (spellType === 'desolateDive') {
      this.vy = 700; // Slam downward fast
      this.vx = 0;
    }
  }

  takeDamage(amount, sound, particles, camera) {
    if (this.godModeActive || this.invincibilityTimer > 0 || this.isDead) return;

    this.health = Math.max(0, this.health - amount);
    this.invincibilityTimer = this.invincibilityDuration;
    this.hurtTimer = 0.25;
    
    sound.playHurt();
    camera.shake(12, 300);
    
    // Slash sparks on player
    particles.spawnHitSparks(this.x + this.width/2, this.y + this.height/2, Math.random() * Math.PI * 2, 10);

    // Cancel healing focus
    this.isFocusing = false;
    this.stopFocusSound();

    if (this.health <= 0) {
      this.isDead = true;
      // Triggers game over screen fade
    }
  }

  stopFocusSound() {
    if (this.focusAudioNodes) {
      try {
        this.focusAudioNodes.osc.stop();
      } catch(e){}
      this.focusAudioNodes = null;
    }
    this.focusSoundPlayed = false;
  }

  collectGeo(amount) {
    this.geo += amount;
  }

  addSoul(amount) {
    this.soul = Math.min(this.maxSoul, this.soul + amount);
  }

  respawnAtLastSafe(level, particles) {
    // Soft teleport back to safe ground or last bench
    this.vx = 0;
    this.vy = 0;
    this.x = this.respawnX;
    this.y = this.respawnY;
    
    // Spawn some puff particles on safe placement
    particles.spawnLandDust(this.x + this.width / 2, this.y + this.height, 5);
  }

  respawnFull(level) {
    this.isDead = false;
    this.health = this.maxHealth;
    this.soul = 0;
    this.vx = 0;
    this.vy = 0;
    this.x = this.respawnX;
    this.y = this.respawnY;
    this.isSitting = true; // Wake up sitting on the bench!
  }

  draw(ctx, camera, game) {
    const cam = camera.getPos();
    const px = Math.round(this.x - cam.x);
    const py = Math.round(this.y - cam.y);

    // Skip drawing occasionally during invincibility flicker
    if (this.invincibilityTimer > 0 && Math.floor(this.animTime * 20) % 2 === 0) {
      return;
    }

    ctx.save();
    
    // Apply hurt visual tilt / red overlay tint (simple drop shadow filter)
    if (this.hurtTimer > 0) {
      ctx.translate(Math.random() * 4 - 2, 0);
    }

    // Wall Cling visual: squash and lean sprite toward the wall
    if (this.isWallClinging) {
      const centerX = px + this.width / 2;
      const centerY = py + this.height / 2;
      ctx.translate(centerX, centerY);
      // Lean the sprite toward the wall (skew horizontally)
      const lean = this.wallClingDir * 0.18; // Tilt toward wall
      ctx.transform(1, 0, lean, 0.92, 0, 0); // Slight squash vertically, lean horizontal
      ctx.translate(-centerX, -centerY);
    }

    const knightImg = game && game.processedAssets && game.processedAssets['knight'];
    if (knightImg) {
      const hx = px + this.width / 2;
      const hy = py + 14;

      // 1. Draw Nail sheathed BEHIND player body if not attacking
      if (this.attackCooldownTimer <= 0 && !this.isSitting) {
        this.drawNailOverlay(ctx, hx, hy);
      }

      // 2. Draw Knight Image Sprite
      ctx.save();
      // Mirror if facing right (since original raw sprite faces left)
      if (this.facing === 'right') {
        ctx.translate(px + this.width / 2, py + this.height / 2);
        ctx.scale(-1, 1);
        ctx.translate(-(px + this.width / 2), -(py + this.height / 2));
      }
      // Add slight breathe scaling
      const breathe = 1.0 + Math.sin(this.animTime * 3.5) * 0.02;
      ctx.translate(px + this.width / 2, py + this.height);
      ctx.scale(1.0, breathe);
      ctx.translate(-(px + this.width / 2), -(py + this.height));

      ctx.drawImage(knightImg, px - 8, py - 6, this.width + 16, this.height + 10);
      ctx.restore();

      // 3. Draw Nail (sword) swing arc in front if attacking
      if (this.attackCooldownTimer > 0) {
        this.drawNailOverlay(ctx, hx, hy);
      }
      
      ctx.restore();
      return;
    }


    // Draw the Knight! Procedural Vector Art style
    
    // 1. Draw Dark Cloak (body silhouette)
    ctx.fillStyle = '#1e2430'; // Dark navy/grey cloak
    ctx.strokeStyle = '#0d121c';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    if (this.isSitting) {
      // Sitting cloak spreads flat
      ctx.moveTo(px - 6, py + this.height);
      ctx.quadraticCurveTo(px + this.width/2, py + this.height - 18, px + this.width + 6, py + this.height);
      ctx.lineTo(px + this.width/2, py + this.height - 25);
    } else {
      // Normal standing/jumping cloak drape
      ctx.moveTo(px, py + 18);
      ctx.quadraticCurveTo(px - 4, py + this.height, px + 2, py + this.height); // Left drape
      ctx.lineTo(px + this.width - 2, py + this.height); // Bottom seam
      ctx.quadraticCurveTo(px + this.width + 4, py + this.height, px + this.width, py + 18); // Right drape
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw Knight's tiny legs if running
    if (this.onGround && Math.abs(this.vx) > 10 && !this.isSitting) {
      ctx.strokeStyle = '#0a0d16';
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      
      const legCycle = Math.sin(this.animTime * 18);
      ctx.beginPath();
      // Left leg
      ctx.moveTo(px + 6, py + this.height - 4);
      ctx.lineTo(px + 4 + legCycle * 4, py + this.height);
      // Right leg
      ctx.moveTo(px + this.width - 6, py + this.height - 4);
      ctx.lineTo(px + this.width - 4 - legCycle * 4, py + this.height);
      ctx.stroke();
    }

    // 2. Draw Knight's White Mask Head
    const headScaleY = 1.0 + Math.sin(this.animTime * 3) * 0.02; // Soft breathing cycle
    const headW = 28;
    const headH = 26;
    const hx = px + this.width / 2;
    const hy = py + 14;

    ctx.fillStyle = '#f0f0f5'; // Clean Bone White mask
    ctx.strokeStyle = '#0d121c';
    ctx.lineWidth = 2.5;

    ctx.beginPath();
    // Start top center (between horns)
    ctx.moveTo(hx, hy - 4);
    
    // Draw Left Horn
    ctx.quadraticCurveTo(hx - 8, hy - 18, hx - 10, hy - 24); // Left Horn Outer
    ctx.quadraticCurveTo(hx - 13, hy - 16, hx - 11, hy - 8);  // Left Horn Inner
    
    // Draw Left Cheek
    ctx.quadraticCurveTo(hx - 14, hy + 4, hx, hy + 8); // Left Jaw/Chin
    
    // Draw Right Cheek
    ctx.quadraticCurveTo(hx + 14, hy + 4, hx + 11, hy - 8);  // Right Jaw
    
    // Draw Right Horn
    ctx.quadraticCurveTo(hx + 13, hy - 16, hx + 10, hy - 24); // Right Horn Inner
    ctx.quadraticCurveTo(hx + 8, hy - 18, hx, hy - 4);        // Right Horn Outer
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 3. Draw Eyes (black hollow sockets)
    ctx.fillStyle = '#080d16';
    
    const eyeOffset = this.facing === 'left' ? -2.5 : 2.5;
    
    ctx.beginPath();
    // Left eye
    ctx.ellipse(hx - 5.5 + eyeOffset, hy - 2, 3.2, 5, 0.08, 0, Math.PI * 2);
    // Right eye
    ctx.ellipse(hx + 5.5 + eyeOffset, hy - 2, 3.2, 5, -0.08, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Nail (sword) sheathed or held during attacks
    if (this.attackCooldownTimer > 0) {
      // Swing swoop motion based on progress
      const progress = this.attackCooldownTimer / this.attackCooldown;
      const angleSweep = Math.sin(progress * Math.PI) * 0.8;
      
      let swingAngle = 0;
      if (this.attackDirection === 'left') swingAngle = -Math.PI * 0.8;
      else if (this.attackDirection === 'right') swingAngle = -Math.PI * 0.2;
      else if (this.attackDirection === 'up') swingAngle = -Math.PI * 0.5;
      else if (this.attackDirection === 'down') swingAngle = Math.PI * 0.5;

      // Draw sword motion blur trail behind the nail blade!
      ctx.save();
      ctx.translate(hx, hy + 6);
      ctx.rotate(swingAngle);
      
      const tProgress = 1 - progress;
      const isFacingLeft = this.facing === 'left';
      const sweepRange = Math.PI * 0.55;
      const startArc = isFacingLeft ? -sweepRange : sweepRange;
      const currentArc = isFacingLeft ? -sweepRange + sweepRange * 2 * tProgress : sweepRange - sweepRange * 2 * tProgress;

      ctx.beginPath();
      ctx.arc(0, 0, 36, isFacingLeft ? -sweepRange : currentArc, isFacingLeft ? currentArc : sweepRange, isFacingLeft);
      ctx.lineTo(0, 0);
      ctx.closePath();
      
      const swordGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
      swordGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      swordGrad.addColorStop(0.4, 'rgba(180, 235, 255, 0.55)');
      swordGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = swordGrad;
      ctx.fill();
      ctx.restore();

      // Swing Nail visually!
      ctx.save();
      ctx.translate(hx, hy + 6);
      ctx.rotate(swingAngle + (this.facing === 'left' ? angleSweep : -angleSweep));

      ctx.fillStyle = '#d5dbdb';
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, 0); // Hilt
      ctx.lineTo(-4, -10);
      ctx.lineTo(0, -32); // Blade tip
      ctx.lineTo(4, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    } else if (!this.isSitting) {
      // Nail sheathed on the back
      ctx.save();
      ctx.translate(hx - (this.facing === 'left' ? -4 : 4), hy + 8);
      ctx.rotate(this.facing === 'left' ? -0.4 : 0.4);

      ctx.fillStyle = '#b2babb';
      ctx.strokeStyle = '#1e2430';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-2, -6);
      ctx.lineTo(0, -22); // Tip
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    }

    ctx.restore();
  }

  drawNailOverlay(ctx, hx, hy) {
    if (this.attackCooldownTimer > 0) {
      const progress = this.attackCooldownTimer / this.attackCooldown;
      const t = 1 - progress; // Sweep progress: 0 to 1

      let swingAngle = 0;
      if (this.attackDirection === 'left') swingAngle = -Math.PI;
      else if (this.attackDirection === 'right') swingAngle = 0;
      else if (this.attackDirection === 'up') swingAngle = -Math.PI / 2;
      else if (this.attackDirection === 'down') swingAngle = Math.PI / 2;

      const sweepRange = 1.1; // Total swing arc range in radians (~63 degrees)
      const dirSign = (this.attackDirection === 'left' || this.attackDirection === 'up') ? -1 : 1;

      // Draw sword motion blur trail behind the nail blade!
      ctx.save();
      ctx.translate(hx, hy + 6);
      ctx.rotate(swingAngle);
      
      const startArc = 0.5 * sweepRange * dirSign;
      const currentArc = -(t - 0.5) * sweepRange * dirSign;

      ctx.beginPath();
      // Draw arc. If dirSign is -1, draw counter-clockwise, else clockwise
      ctx.arc(0, 0, 36, startArc, currentArc, dirSign === -1);
      ctx.lineTo(0, 0);
      ctx.closePath();
      
      const swordGrad = ctx.createRadialGradient(0, 0, 8, 0, 0, 36);
      swordGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      swordGrad.addColorStop(0.4, 'rgba(180, 235, 255, 0.55)');
      swordGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      
      ctx.fillStyle = swordGrad;
      ctx.fill();
      ctx.restore();

      // Swing Nail visually!
      ctx.save();
      ctx.translate(hx, hy + 6);
      // Shape is drawn pointing UP (so we add PI/2 to align with X-axis rotation)
      const currentAngle = swingAngle - (t - 0.5) * sweepRange * dirSign;
      ctx.rotate(currentAngle + Math.PI / 2);

      ctx.fillStyle = '#d5dbdb';
      ctx.strokeStyle = '#2c3e50';
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.moveTo(0, 0); // Hilt
      ctx.lineTo(-4, -10);
      ctx.lineTo(0, -32); // Blade tip
      ctx.lineTo(4, -10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    } else if (!this.isSitting) {
      // Nail sheathed on the back
      ctx.save();
      ctx.translate(hx - (this.facing === 'left' ? -4 : 4), hy + 8);
      ctx.rotate(this.facing === 'left' ? -0.4 : 0.4);

      ctx.fillStyle = '#b2babb';
      ctx.strokeStyle = '#1e2430';
      ctx.lineWidth = 1;

      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-2, -6);
      ctx.lineTo(0, -22); // Tip
      ctx.lineTo(2, -6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      
      ctx.restore();
    }
  }
}
export default Player;
