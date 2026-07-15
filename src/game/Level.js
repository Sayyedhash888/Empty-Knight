export class Level {
  constructor() {
    this.tileSize = 40;
    this.currentRoomIndex = 0;
    
    this.rooms = [
      this.createDirtmouthRoom(),
      this.createCrossroadsRoom(),
      this.createBossArenaRoom()
    ];

    // Pulsing timer for bioluminescent elements
    this.pulseTime = 0;
  }

  get currentRoom() {
    return this.rooms[this.currentRoomIndex];
  }

  get cols() {
    return this.currentRoom.grid[0].length;
  }

  get rows() {
    return this.currentRoom.grid.length;
  }

  getTile(row, col) {
    if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) {
      return 1; // Out of bounds is solid
    }
    return this.currentRoom.grid[row][col];
  }

  isSolid(row, col) {
    return this.getTile(row, col) === 1;
  }

  isPositionSolid(x, y) {
    const col = Math.floor(x / this.tileSize);
    const row = Math.floor(y / this.tileSize);
    return this.isSolid(row, col);
  }

  loadRoom(index) {
    if (index >= 0 && index < this.rooms.length) {
      this.currentRoomIndex = index;
      
      // Reset destructible rock healths
      this.rooms[index].geoRocks.forEach(rock => {
        rock.hp = rock.maxHp;
        rock.isBroken = false;
      });

      return this.currentRoom;
    }
    return null;
  }

  update(deltaTime) {
    this.pulseTime += deltaTime;
  }

  draw(ctx, camera, game) {
    const cam = camera.getPos();
    const startCol = Math.max(0, Math.floor(cam.x / this.tileSize));
    const endCol = Math.min(this.cols - 1, Math.ceil((cam.x + camera.viewportWidth) / this.tileSize));
    const startRow = Math.max(0, Math.floor(cam.y / this.tileSize));
    const endRow = Math.min(this.rows - 1, Math.ceil((cam.y + camera.viewportHeight) / this.tileSize));

    // 1. Draw Parallax Backgrounds (Layers 1-3)
    this.drawParallaxBackground(ctx, camera, game);

    // 2. Draw Interactive level objects (Benches, Tablets, Geo Rocks)
    this.drawInteractables(ctx, cam);

    // 3. Draw Organic Tiles (Ground, Walls, Ceilings)
    ctx.save();
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        const tile = this.rooms[this.currentRoomIndex].grid[r][c];
        const tx = c * this.tileSize - cam.x;
        const ty = r * this.tileSize - cam.y;

        if (tile === 1) {
          this.drawOrganicTile(ctx, r, c, tx, ty);
        } 
        else if (tile === 2) {
          this.drawOrganicSpikes(ctx, tx, ty);
        }
      }
    }
    ctx.restore();

    // 4. Draw Foreground silhouette overlay layer (Layer 5 - 1.3x speed)
    this.drawForegroundOverlay(ctx, camera);
  }

  drawOrganicTile(ctx, r, c, tx, ty) {
    // Check neighbor states to draw hand-drawn organic curves
    const upSolid = this.isSolid(r - 1, c);
    const downSolid = this.isSolid(r + 1, c);
    const leftSolid = this.isSolid(r, c - 1);
    const rightSolid = this.isSolid(r, c + 1);

    const ts = this.tileSize;

    // Draw main base rock block
    ctx.beginPath();
    ctx.rect(tx, ty, ts, ts);
    const grad = ctx.createLinearGradient(tx, ty, tx, ty + ts);
    grad.addColorStop(0, '#151b24');
    grad.addColorStop(1, '#0b0e14');
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.strokeStyle = '#222f3e';
    ctx.lineWidth = 1;
    ctx.strokeRect(tx, ty, ts, ts);

    // Render curves on edges
    ctx.strokeStyle = '#2c3e50';
    ctx.fillStyle = '#0f141b';
    ctx.lineWidth = 2.5;

    // --- 1. Floor edge (Bumpy, mossy top) ---
    if (!upSolid) {
      ctx.save();
      // Draw organic jagged surface
      ctx.beginPath();
      ctx.moveTo(tx, ty + 2);
      ctx.quadraticCurveTo(tx + ts * 0.25, ty - 3, tx + ts * 0.5, ty + 1);
      ctx.quadraticCurveTo(tx + ts * 0.75, ty + 4, tx + ts, ty + 2);
      ctx.lineTo(tx + ts, ty + ts * 0.3);
      ctx.lineTo(tx, ty + ts * 0.3);
      ctx.closePath();
      ctx.fillStyle = '#0f131a';
      ctx.fill();
      ctx.stroke();

      // Moss tufts (glowing green/blue grass strands)
      ctx.strokeStyle = this.currentRoomIndex === 1 ? '#1abc9c' : '#45b3e0'; // crossroads teal, dirtmouth soft blue
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Left tuft
      ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + 6, ty - 6);
      ctx.moveTo(tx + 8, ty); ctx.lineTo(tx + 10, ty - 4);
      // Right tuft
      ctx.moveTo(tx + ts - 12, ty + 2); ctx.lineTo(tx + ts - 14, ty - 5);
      ctx.moveTo(tx + ts - 12, ty + 2); ctx.lineTo(tx + ts - 9, ty - 4);
      ctx.stroke();
      ctx.restore();
    }

    // --- 2. Ceiling edge (Downward pointing jagged rocks and vines) ---
    if (!downSolid) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tx, ty + ts - 2);
      ctx.quadraticCurveTo(tx + ts * 0.3, ty + ts + 4, tx + ts * 0.5, ty + ts - 2);
      ctx.quadraticCurveTo(tx + ts * 0.7, ty + ts - 5, tx + ts, ty + ts - 1);
      ctx.lineTo(tx + ts, ty + ts * 0.7);
      ctx.lineTo(tx, ty + ts * 0.7);
      ctx.closePath();
      ctx.fillStyle = '#0a0d14';
      ctx.fill();
      ctx.stroke();

      // Hanging roots / vines
      if ((r + c) % 3 === 0) {
        ctx.strokeStyle = '#1b2631';
        ctx.lineWidth = 2.0;
        ctx.beginPath();
        ctx.moveTo(tx + ts * 0.4, ty + ts);
        ctx.bezierCurveTo(tx + ts*0.3, ty + ts + 15, tx + ts*0.6, ty + ts + 18, tx + ts*0.45, ty + ts + 32);
        ctx.stroke();
        
        // Leaf on vine end
        ctx.fillStyle = this.currentRoomIndex === 1 ? 'rgba(26,188,156,0.5)' : 'rgba(70,160,220,0.5)';
        ctx.beginPath();
        ctx.arc(tx + ts * 0.45, ty + ts + 32, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // --- 3. Left Wall edge ---
    if (!leftSolid) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tx + 2, ty);
      ctx.quadraticCurveTo(tx - 3, ty + ts * 0.5, tx + 1, ty + ts);
      ctx.strokeStyle = '#2c3e50';
      ctx.stroke();
      ctx.restore();
    }

    // --- 4. Right Wall edge ---
    if (!rightSolid) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(tx + ts - 2, ty);
      ctx.quadraticCurveTo(tx + ts + 3, ty + ts * 0.5, tx + ts - 1, ty + ts);
      ctx.strokeStyle = '#2c3e50';
      ctx.stroke();
      ctx.restore();
    }

    // Rock cracks and internal texture details
    if ((r * c) % 5 === 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath();
      ctx.moveTo(tx + 8, ty + 12);
      ctx.lineTo(tx + 22, ty + 28);
      ctx.lineTo(tx + 18, ty + 32);
      ctx.stroke();
    }
  }

  drawOrganicSpikes(ctx, tx, ty) {
    const ts = this.tileSize;
    ctx.save();
    
    // Draw highly jagged, detailed procedural spikes
    const spikeCount = 3;
    const w = ts / spikeCount;

    ctx.beginPath();
    for (let i = 0; i < spikeCount; i++) {
      const sx = tx + i * w;
      // Jagged tip with curves
      ctx.moveTo(sx, ty + ts);
      ctx.quadraticCurveTo(sx + w * 0.2, ty + ts * 0.4, sx + w * 0.5, ty + 3);
      ctx.quadraticCurveTo(sx + w * 0.8, ty + ts * 0.4, sx + w, ty + ts);
    }
    ctx.closePath();

    const grad = ctx.createLinearGradient(tx, ty, tx, ty + ts);
    grad.addColorStop(0, '#566573');
    grad.addColorStop(0.5, '#2e4053');
    grad.addColorStop(1, '#1a252f');
    ctx.fillStyle = grad;
    ctx.fill();

    // Sharp highlights
    ctx.strokeStyle = '#95a5a6';
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // Little details on floor spikes
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    for (let i = 0; i < spikeCount; i++) {
      ctx.beginPath();
      ctx.arc(tx + i * w + w * 0.5, ty + 15, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  drawParallaxBackground(ctx, camera, game) {
    const cam = camera.getPos();
    const w = camera.viewportWidth;
    const h = camera.viewportHeight;

    // Layer 0: Flat ambient fog color
    ctx.fillStyle = this.currentRoom.bgGradient;
    ctx.fillRect(0, 0, w, h);

    // Draw custom background images if loaded!
    const bgImg = game && game.processedAssets && (
      this.currentRoomIndex === 0 ? game.processedAssets['dirtmouthBg'] : game.processedAssets['cavernBg']
    );

    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = 0.55; // Blend background image nicely
      const scrollX = -(cam.x * 0.15) % bgImg.width;
      const scrollY = -(cam.y * 0.15);
      
      // Draw repeating background tiles
      ctx.drawImage(bgImg, scrollX - bgImg.width, scrollY, bgImg.width, h);
      ctx.drawImage(bgImg, scrollX, scrollY, bgImg.width, h);
      ctx.drawImage(bgImg, scrollX + bgImg.width, scrollY, bgImg.width, h);
      ctx.restore();
    }

    // Layer 1: Far Cavernous silhouettes (0.12x speed)
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#070a14';
    const l1X = -(cam.x * 0.12) % 480;
    for (let x = l1X - 480; x < w + 480; x += 480) {
      // Big hazy cavern hills
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.quadraticCurveTo(x + 120, h - 320, x + 240, h - 220);
      ctx.quadraticCurveTo(x + 360, h - 380, x + 480, h);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Layer 2: Mid Cavern Ruins & Gothic arches (0.35x speed)
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.fillStyle = '#0c1220';
    const l2X = -(cam.x * 0.35) % 640;
    for (let x = l2X - 640; x < w + 640; x += 640) {
      // Giant broken pillars
      ctx.fillRect(x + 80, h - 380, 50, 380);
      ctx.fillRect(x + 480, h - 420, 65, 420);

      // Gothic arches connecting pillars
      ctx.strokeStyle = '#0c1220';
      ctx.lineWidth = 18;
      ctx.beginPath();
      ctx.arc(x + 300, h - 200, 160, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();

    // Layer 3: Close ruins elements & glowing crystals (0.65x speed)
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#0f182c';
    const l3X = -(cam.x * 0.65) % 800;
    
    // Pulse crystal brightness
    const crystalGlow = 0.4 + Math.sin(this.pulseTime * 2.5) * 0.25;

    for (let x = l3X - 800; x < w + 800; x += 800) {
      // Small columns
      ctx.fillRect(x + 150, h - 240, 24, 240);
      ctx.fillRect(x + 600, h - 280, 30, 280);

      // Draw bioluminescent glowing crystal formations in midground!
      ctx.save();
      ctx.fillStyle = 'rgba(77, 182, 235, ' + crystalGlow + ')';
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#4db6eb';

      // Crystal clusters at base of pillars
      ctx.beginPath();
      ctx.moveTo(x + 140, h);
      ctx.lineTo(x + 144, h - 25);
      ctx.lineTo(x + 150, h);
      ctx.moveTo(x + 152, h);
      ctx.lineTo(x + 157, h - 32);
      ctx.lineTo(x + 163, h);
      ctx.fill();
      
      ctx.restore();
    }
    ctx.restore();
  }

  drawForegroundOverlay(ctx, camera) {
    const cam = camera.getPos();
    const w = camera.viewportWidth;
    const h = camera.viewportHeight;

    // Layer 5: Large out-of-focus foreground columns and foliage (1.25x speed)
    ctx.save();
    ctx.fillStyle = '#05070a'; // Absolute pitch dark silhouette
    
    const fgX = -(cam.x * 1.25) % 900;
    
    for (let x = fgX - 900; x < w + 900; x += 900) {
      // Giant foreground column
      ctx.fillRect(x + 50, -50, 80, h + 100);

      // Hanging foreground heavy vines
      ctx.beginPath();
      ctx.moveTo(x + 350, 0);
      ctx.bezierCurveTo(x + 330, 100, x + 380, 150, x + 360, 260);
      ctx.lineTo(x + 390, 260);
      ctx.bezierCurveTo(x + 400, 150, x + 360, 100, x + 380, 0);
      ctx.closePath();
      ctx.fill();
      
      // Hanging leaves
      ctx.beginPath();
      ctx.arc(x + 360, 260, 15, 0, Math.PI * 2);
      ctx.arc(x + 372, 210, 20, 0, Math.PI * 2);
      ctx.arc(x + 348, 120, 18, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawInteractables(ctx, cam) {
    const room = this.rooms[this.currentRoomIndex];

    // 1. Draw Bench
    room.benches.forEach(bench => {
      const bx = bench.x - cam.x;
      const by = bench.y - cam.y;
      
      ctx.save();
      ctx.fillStyle = '#222f3e';
      ctx.strokeStyle = '#cfd8dc';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#000';

      // Bench Seat
      ctx.fillRect(bx, by + 12, bench.width, 10);
      ctx.strokeRect(bx, by + 12, bench.width, 10);

      // Bench Legs
      ctx.fillRect(bx + 10, by + 22, 6, 8);
      ctx.fillRect(bx + bench.width - 16, by + 22, 6, 8);

      // Backrest arches
      ctx.beginPath();
      ctx.arc(bx + 20, by + 12, 10, Math.PI, 0);
      ctx.arc(bx + bench.width - 20, by + 12, 10, Math.PI, 0);
      ctx.fillStyle = '#10171e';
      ctx.fill();
      ctx.stroke();

      ctx.restore();
    });

    // 2. Draw Lore Tablets
    room.tablets.forEach(tab => {
      const tx = tab.x - cam.x;
      const ty = tab.y - cam.y;

      ctx.save();
      ctx.fillStyle = '#1c2833';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.shadowBlur = 12;
      ctx.shadowColor = 'rgba(255, 255, 255, 0.2)';

      // Stone
      ctx.beginPath();
      ctx.roundRect(tx, ty, 30, 45, 4);
      ctx.fill();
      ctx.stroke();

      // Ancient inscriptions
      ctx.strokeStyle = '#90a4ae';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tx + 8, ty + 12);
      ctx.lineTo(tx + 22, ty + 12);
      ctx.moveTo(tx + 6, ty + 20);
      ctx.lineTo(tx + 24, ty + 20);
      ctx.moveTo(tx + 10, ty + 28);
      ctx.lineTo(tx + 20, ty + 28);
      ctx.stroke();

      ctx.restore();
    });

    // 3. Draw Geo Rocks
    room.geoRocks.forEach(rock => {
      if (rock.isBroken) return;
      const rx = rock.x - cam.x;
      const ry = rock.y - cam.y;

      ctx.save();
      ctx.fillStyle = '#22313f';
      ctx.strokeStyle = '#0d131a';
      ctx.lineWidth = 2.5;
      
      // Jagged polygon shell
      ctx.beginPath();
      ctx.moveTo(rx + 15, ry);
      ctx.lineTo(rx + 35, ry + 8);
      ctx.lineTo(rx + 40, ry + 32);
      ctx.lineTo(rx + 25, ry + 40);
      ctx.lineTo(rx, ry + 30);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Pulsing gold crystals
      const crystalPulse = 8 + Math.sin(this.pulseTime * 4) * 4;
      ctx.fillStyle = '#f1c40f';
      ctx.shadowBlur = crystalPulse;
      ctx.shadowColor = '#f39c12';
      
      ctx.beginPath();
      ctx.moveTo(rx + 12, ry + 15);
      ctx.lineTo(rx + 17, ry + 10);
      ctx.lineTo(rx + 22, ry + 17);
      ctx.lineTo(rx + 15, ry + 22);
      ctx.closePath();
      ctx.fill();

      ctx.beginPath();
      ctx.moveTo(rx + 22, ry + 28);
      ctx.lineTo(rx + 28, ry + 22);
      ctx.lineTo(rx + 34, ry + 30);
      ctx.lineTo(rx + 26, ry + 34);
      ctx.closePath();
      ctx.fill();

      ctx.restore();
    });

    // 4. Draw Well in Dirtmouth
    if (this.currentRoomIndex === 0) {
      const wx = 800 - cam.x;
      const wy = 440 - cam.y;

      ctx.save();
      ctx.fillStyle = '#16202c';
      ctx.fillRect(wx, wy, 80, 40);
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(wx, wy, 80, 40);
      
      ctx.fillStyle = '#030508';
      ctx.fillRect(wx + 10, wy + 10, 60, 30);
      ctx.restore();
    }

    // 5. Draw Bioluminescent plants growing in Forgotten Crossroads!
    if (this.currentRoomIndex === 1) {
      this.drawBioluminescentPlants(ctx, cam);
    }
  }

  drawBioluminescentPlants(ctx, cam) {
    const pulse = 0.5 + Math.sin(this.pulseTime * 2) * 0.35;
    
    // Plant locations (hardcoded for beauty)
    const plantLocations = [
      { x: 380, y: 550 },
      { x: 670, y: 710 },
      { x: 1300, y: 750 },
      { x: 1720, y: 430 }
    ];

    plantLocations.forEach(p => {
      const px = p.x - cam.x;
      const py = p.y - cam.y;

      ctx.save();
      
      // Outer light aura
      ctx.fillStyle = 'rgba(52, 152, 219, ' + (pulse * 0.15) + ')';
      ctx.beginPath();
      ctx.arc(px, py, 35, 0, Math.PI * 2);
      ctx.fill();

      // Plant bulbs
      ctx.fillStyle = '#3498db';
      ctx.strokeStyle = '#2980b9';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 12 * pulse;
      ctx.shadowColor = '#5dade2';

      ctx.beginPath();
      ctx.moveTo(px, py + 8);
      ctx.bezierCurveTo(px - 15, py - 10, px - 5, py - 25, px, py - 20);
      ctx.bezierCurveTo(px + 5, py - 25, px + 15, py - 10, px, py + 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Glowing core orb
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px, py - 10, 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    });
  }

  /* --- Room Creators --- */

  createDirtmouthRoom() {
    const grid = [];
    const cols = 30;
    const rows = 18; // Taller room for better jump feel

    for (let r = 0; r < rows; r++) {
      grid.push(new Array(cols).fill(0));
    }

    for (let c = 0; c < cols; c++) {
      grid[0][c] = 1;        // Ceiling
      grid[rows - 1][c] = 1; // Floor
    }
    for (let r = 0; r < rows; r++) {
      grid[r][0] = 1;        // Left wall
      grid[r][cols - 1] = 1; // Right wall
    }

    // Floating platforms at different heights for parkour
    for (let c = 6; c <= 9; c++) grid[rows - 5][c] = 1;
    for (let c = 14; c <= 17; c++) grid[rows - 7][c] = 1;
    for (let c = 21; c <= 24; c++) grid[rows - 4][c] = 1;

    // Well opening (gate to Crossroads)
    grid[rows - 1][20] = 0;
    grid[rows - 1][21] = 0;
    grid[rows - 2][19] = 1;
    grid[rows - 2][22] = 1;

    return {
      grid: grid,
      bgGradient: '#070a14',
      benches: [
        { x: 160, y: (rows - 2) * 40, width: 70, height: 22 }
      ],
      tablets: [
        { x: 450, y: (rows - 2) * 40, text: "Welcome to Dirtmouth. Hold S near the bench to rest and recover. Jump down the well to face the Forgotten Crossroads. Controls: MOVE [A/D], JUMP [Space/C], ATTACK [Left Click/Z], DASH [Right Click/Shift], CAST SPELL [W then Left Click / Q], FOCUS HEAL [W - hold still]." }
      ],
      geoRocks: [],
      gates: [
        { x: 800, y: (rows - 1) * 40 - 10, width: 80, height: 10, targetRoom: 1, spawnX: 300, spawnY: 200 }
      ],
      enemies: []
    };
  }

  createCrossroadsRoom() {
    const cols = 50;
    const rows = 26; // Taller room
    const grid = [];

    for (let r = 0; r < rows; r++) {
      grid.push(new Array(cols).fill(0));
    }

    for (let c = 0; c < cols; c++) {
      grid[0][c] = 1;
      grid[rows - 1][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
      grid[r][0] = 1;
      grid[r][cols - 1] = 1;
    }

    // Left alcove ceiling opening (goes back to Dirtmouth)
    for (let c = 6; c <= 9; c++) grid[0][c] = 0;
    for (let r = 1; r <= 4; r++) {
      grid[r][5] = 1;
      grid[r][10] = 1;
    }

    // Mid-room upper platform (higher up for interesting jumps)
    for (let c = 0; c < 22; c++) grid[18][c] = 1;
    grid[18][10] = 0;
    grid[18][11] = 0;

    // Raised platforms on the right mid section
    grid[21][12] = 1;
    grid[21][13] = 1;
    grid[19][16] = 1;
    grid[19][17] = 1;
    grid[19][18] = 1;

    // Spike field at bottom right
    for (let c = 20; c <= 30; c++) {
      grid[rows - 2][c] = 2; // Spikes
      grid[rows - 1][c] = 1;
    }

    // Floating platform over spikes
    grid[18][22] = 1;
    grid[18][23] = 1;
    grid[18][27] = 1;
    grid[18][28] = 1;

    // Vertical wall divider with door gap
    for (let r = 10; r < rows; r++) grid[r][36] = 1;
    grid[19][36] = 0;
    grid[20][36] = 0;
    grid[21][36] = 0;
    grid[22][36] = 0;

    // Right-side elevated area
    for (let c = 37; c < cols; c++) grid[14][c] = 1;

    return {
      grid: grid,
      bgGradient: '#04070f',
      benches: [
        { x: 720, y: (rows - 2) * 40, width: 70, height: 22 }
      ],
      tablets: [
        { x: 280, y: 17 * 40, text: "Be careful of spikes below! Attack DOWN in mid-air (Pogoing) off spikes or enemies to bounce. Cast VENGEFUL SPIRIT [Q or W+Attack] to shoot a magic projectile. DESOLATE DIVE [W+Down+Attack in air] slams downward!" },
        { x: 1550, y: 13 * 40, text: "Ahead lies the Arena of the False Knight. Defeat him to unlock the door." }
      ],
      geoRocks: [
        { x: 200, y: 17 * 40, hp: 3, maxHp: 3, isBroken: false, value: 8 },
        { x: 1100, y: (rows - 2) * 40, hp: 3, maxHp: 3, isBroken: false, value: 12 },
        { x: 1800, y: 13 * 40, hp: 3, maxHp: 3, isBroken: false, value: 15 }
      ],
      gates: [
        { x: 240, y: 0, width: 160, height: 10, targetRoom: 0, spawnX: 820, spawnY: (18 - 2) * 40 - 50 },
        { x: 1960, y: 19 * 40, width: 40, height: 260, targetRoom: 2, spawnX: 100, spawnY: 400 }
      ],
      enemies: [
        { type: 'crawlid', x: 500, y: 17 * 40 - 30 },
        { type: 'crawlid', x: 1200, y: (rows - 2) * 40 - 30 },
        { type: 'vengefly', x: 950, y: 14 * 40 },
        { type: 'vengefly', x: 1500, y: 16 * 40 }
      ]
    };
  }

  createBossArenaRoom() {
    const cols = 30;
    const rows = 18; // Tall boss room
    const grid = [];

    for (let r = 0; r < rows; r++) {
      grid.push(new Array(cols).fill(0));
    }

    for (let c = 0; c < cols; c++) {
      grid[0][c] = 1;
      grid[rows - 1][c] = 1;
    }
    for (let r = 0; r < rows; r++) {
      grid[r][0] = 1;
      grid[r][cols - 1] = 1;
    }

    // Raised platforms for the boss fight
    for (let c = 5; c <= 9; c++) grid[rows - 5][c] = 1;
    for (let c = 20; c <= 24; c++) grid[rows - 5][c] = 1;
    for (let c = 12; c <= 17; c++) grid[rows - 8][c] = 1;

    return {
      grid: grid,
      bgGradient: '#020408',
      benches: [],
      tablets: [],
      geoRocks: [],
      gates: [
        { x: 0, y: (rows - 6) * 40, width: 40, height: 200, targetRoom: 1, spawnX: 1900, spawnY: (26 - 2) * 40 - 60 }
      ],
      enemies: [
        { type: 'boss', x: 600, y: (rows - 4) * 40 }
      ]
    };
  }
}
export default Level;
