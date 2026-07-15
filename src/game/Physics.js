export class Physics {
  static checkCollisions(entity, level, deltaTime) {
    // Reset collision states
    entity.onGround = false;
    entity.onWallLeft = false;
    entity.onWallRight = false;
    entity.touchingSpikes = false;

    const tileSize = level.tileSize;

    // --- 1. X Axis Collision ---
    entity.x += entity.vx * deltaTime;
    
    // Check bounding box overlaps
    let bounds = this.getEntityTileBounds(entity, level);
    
    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const tile = level.getTile(r, c);
        
        if (tile === 1) { // Solid block
          // Resolve overlap
          if (entity.vx > 0) { // Moving right
            const tileLeft = c * tileSize;
            if (entity.x + entity.width > tileLeft) {
              entity.x = tileLeft - entity.width;
              entity.vx = 0;
              entity.onWallRight = true;
            }
          } else if (entity.vx < 0) { // Moving left
            const tileRight = (c + 1) * tileSize;
            if (entity.x < tileRight) {
              entity.x = tileRight;
              entity.vx = 0;
              entity.onWallLeft = true;
            }
          }
        } else if (tile === 2) { // Spikes
          if (this.isOverlapping(entity, c * tileSize, r * tileSize, tileSize, tileSize)) {
            entity.touchingSpikes = true;
          }
        }
      }
    }

    // --- 2. Y Axis Collision ---
    entity.y += entity.vy * deltaTime;
    bounds = this.getEntityTileBounds(entity, level);

    for (let r = bounds.minRow; r <= bounds.maxRow; r++) {
      for (let c = bounds.minCol; c <= bounds.maxCol; c++) {
        const tile = level.getTile(r, c);

        if (tile === 1) { // Solid block
          // Resolve overlap
          if (entity.vy > 0) { // Falling down
            const tileTop = r * tileSize;
            if (entity.y + entity.height > tileTop) {
              entity.y = tileTop - entity.height;
              entity.vy = 0;
              entity.onGround = true;
            }
          } else if (entity.vy < 0) { // Moving up
            const tileBottom = (r + 1) * tileSize;
            if (entity.y < tileBottom) {
              entity.y = tileBottom;
              entity.vy = 0;
            }
          }
        } else if (tile === 2) { // Spikes
          if (this.isOverlapping(entity, c * tileSize, r * tileSize, tileSize, tileSize)) {
            entity.touchingSpikes = true;
          }
        }
      }
    }

    // Level map boundary enforcement
    const mapWidth = level.cols * tileSize;
    const mapHeight = level.rows * tileSize;

    if (entity.x < 0) {
      entity.x = 0;
      entity.vx = 0;
      entity.onWallLeft = true;
    } else if (entity.x + entity.width > mapWidth) {
      entity.x = mapWidth - entity.width;
      entity.vx = 0;
      entity.onWallRight = true;
    }

    // Bottom pit death fallback (if no solids)
    if (entity.y + entity.height > mapHeight) {
      entity.y = mapHeight - entity.height;
      entity.vy = 0;
      entity.onGround = true;
      // Trigger out of bounds spikes damage
      entity.touchingSpikes = true;
    }
  }

  // Get tile coordinate range covered by entity
  static getEntityTileBounds(entity, level) {
    const tileSize = level.tileSize;
    const buffer = 0.5; // Avoid floating point rounding issues
    
    const minCol = Math.max(0, Math.floor((entity.x + buffer) / tileSize));
    const maxCol = Math.min(level.cols - 1, Math.floor((entity.x + entity.width - buffer) / tileSize));
    
    const minRow = Math.max(0, Math.floor((entity.y + buffer) / tileSize));
    const maxRow = Math.min(level.rows - 1, Math.floor((entity.y + entity.height - buffer) / tileSize));

    return { minCol, maxCol, minRow, maxRow };
  }

  static isOverlapping(rect1, x2, y2, w2, h2) {
    return rect1.x < x2 + w2 &&
           rect1.x + rect1.width > x2 &&
           rect1.y < y2 + h2 &&
           rect1.y + rect1.height > y2;
  }
}
export default Physics;
