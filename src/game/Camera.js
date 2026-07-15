export class Camera {
  constructor(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
    
    this.x = 0;
    this.y = 0;
    
    this.targetX = 0;
    this.targetY = 0;
    
    this.lerpSpeed = 0.08; // Smooth follow speed

    // Screen Shake settings
    this.shakeDuration = 0;
    this.shakeIntensity = 0;
    this.shakeOffsetX = 0;
    this.shakeOffsetY = 0;
    
    // Bounds
    this.minX = 0;
    this.maxX = 0;
    this.minY = 0;
    this.maxY = 0;
  }

  resize(width, height) {
    this.viewportWidth = width;
    this.viewportHeight = height;
  }

  setBounds(minX, minY, maxX, maxY) {
    this.minX = minX;
    this.minY = minY;
    this.maxX = maxX - this.viewportWidth;
    this.maxY = maxY - this.viewportHeight;

    // If level is smaller than viewport, center it
    if (this.maxX < this.minX) {
      const diff = this.viewportWidth - (maxX - minX);
      this.minX = minX - diff / 2;
      this.maxX = this.minX;
    }
    if (this.maxY < this.minY) {
      const diff = this.viewportHeight - (maxY - minY);
      this.minY = minY - diff / 2;
      this.maxY = this.minY;
    }
  }

  follow(targetX, targetY, instant = false) {
    // Center of viewport target
    this.targetX = targetX - this.viewportWidth / 2;
    this.targetY = targetY - this.viewportHeight / 2;

    if (instant) {
      this.x = this.clampX(this.targetX);
      this.y = this.clampY(this.targetY);
    }
  }

  shake(intensity, durationMs) {
    this.shakeIntensity = intensity;
    this.shakeDuration = durationMs;
  }

  clampX(x) {
    return Math.max(this.minX, Math.min(this.maxX, x));
  }

  clampY(y) {
    return Math.max(this.minY, Math.min(this.maxY, y));
  }

  update(deltaTime) {
    // Smooth lerp to target
    let newX = this.x + (this.targetX - this.x) * this.lerpSpeed;
    let newY = this.y + (this.targetY - this.y) * this.lerpSpeed;

    this.x = this.clampX(newX);
    this.y = this.clampY(newY);

    // Apply Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= deltaTime * 1000;
      
      // Random offset based on intensity
      this.shakeOffsetX = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.shakeOffsetY = (Math.random() * 2 - 1) * this.shakeIntensity;

      // Damp shake over time
      if (this.shakeDuration <= 0) {
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
        this.shakeIntensity = 0;
      }
    } else {
      this.shakeOffsetX = 0;
      this.shakeOffsetY = 0;
    }
  }

  // Get current screen position including shake
  getPos() {
    return {
      x: Math.round(this.x + this.shakeOffsetX),
      y: Math.round(this.y + this.shakeOffsetY)
    };
  }
}
export default Camera;
