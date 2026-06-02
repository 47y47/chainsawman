/* ─── 波奇塔桌面宠物 v2.2 — 8 帧精灵动画 ──────── */
(function () {
  'use strict';

  const PET_W = 80;            // walk display width (px)
  const PET_H = 80;            // walk display height
  const JUMP_W = 100;          // jump display width
  const JUMP_H = 100;          // jump display height
  const BATTLE_W = 100;        // battle display width
  const BATTLE_H = 100;        // battle display height
  const SPEED = 40;            // patrol speed (px/s)
  const FRAME_COUNT = 8;       // walk frames in sprite sheet
  const FRAME_W = 80;          // single frame display width
  const FRAME_INTERVAL = 120;  // ms per frame (~8.3 fps)
  const JUMP_DURATION = 500;
  const BATTLE_IMG = '../assets/images/pochita_battle.png';
  const WALK_IMG = '../assets/images/pochita_walk.png';

  class PochitaPet {
    constructor(container) {
      this.container = container;
      this.spriteWrap = container.querySelector('.pet__sprite-wrap');
      this.spriteEl = container.querySelector('.pet__sprite');
      this.jumpWrap = container.querySelector('.pet__jump-wrap');
      this.jumpImg = container.querySelector('.pet__jump');
      this.facingRight = true;
      this.x = 0;
      this.baseY = 0;
      this.leftBound = 0;
      this.rightBound = 0;
      this.state = 'patrol';
      this.frameIdx = 0;
      this.frameTimer = 0;
      this.lastTime = performance.now();
      this.landTimer = null;

      this._onClick = this._onClick.bind(this);
      this._loop = this._loop.bind(this);
      this._calcBounds = this._calcBounds.bind(this);

      this._init();
    }

    _init() {
      this.spriteWrap.style.width = PET_W + 'px';
      this.spriteWrap.style.height = PET_H + 'px';
      this.spriteEl.style.width = PET_W + 'px';
      this.spriteEl.style.height = PET_H + 'px';
      this.jumpWrap.style.width = JUMP_W + 'px';
      this.jumpWrap.style.height = JUMP_H + 'px';
      this.jumpImg.style.width = JUMP_W + 'px';
      this.jumpImg.style.height = JUMP_H + 'px';

      this.container.addEventListener('click', this._onClick);
      this.container.addEventListener('pointerdown', (e) => e.stopPropagation());

      this._calcBounds();
      window.addEventListener('resize', () => this._calcBounds());

      this.x = this.leftBound + (this.rightBound - this.leftBound) / 2;
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop);
    }

    _calcBounds() {
      if (this.state === 'battle') return; // don't reset during charge
      const footer = document.querySelector('.footer');
      if (footer) {
        const fr = footer.getBoundingClientRect();
        this.baseY = fr.top - PET_H + 4;
        const app = document.getElementById('app');
        if (app) {
          const ar = app.getBoundingClientRect();
          this.leftBound = ar.left + 8;
          this.rightBound = ar.right - PET_W - 8;
        } else {
          this.leftBound = 8;
          this.rightBound = window.innerWidth - PET_W - 8;
        }
      } else {
        this.baseY = window.innerHeight - 60 - PET_H;
        this.leftBound = 8;
        this.rightBound = window.innerWidth - PET_W - 8;
      }
    }

    _onClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (this.state === 'battle') return; // ignore clicks during battle

      // Cancel any in-progress landing
      if (this.landTimer) { clearTimeout(this.landTimer); this.landTimer = null; }

      // First click in a series: switch to jump image
      if (this.state !== 'jump') {
        this.state = 'jump';
        this.bounceStack = 0;
        this.spriteWrap.style.display = 'none';
        this.jumpWrap.style.display = 'block';
      }

      // Stack additional bounce height per click
      this.bounceStack++;
      const offsetY = -this.bounceStack * 16; // 16px higher per click
      const flip = this.facingRight ? 'scaleX(1)' : 'scaleX(-1)';
      this.jumpWrap.style.transform = `${flip} translateY(${offsetY}px)`;

      // Re-trigger bounce animation on the image
      this.jumpImg.classList.remove('pet--bounce');
      void this.jumpImg.offsetWidth;
      this.jumpImg.classList.add('pet--bounce');

      // Reset timer — jump ends when user stops clicking
      if (this.jumpTimer) clearTimeout(this.jumpTimer);
      this.jumpTimer = setTimeout(() => {
        // Smooth landing: transition translateY back to 0
        this.jumpImg.classList.remove('pet--bounce');
        const flip = this.facingRight ? 'scaleX(1)' : 'scaleX(-1)';
        this.jumpWrap.style.transform = flip; // CSS transition handles the fall
        // After transition, swap back to walk sprite
        this.landTimer = setTimeout(() => {
          this.jumpWrap.style.display = 'none';
          this.spriteWrap.style.display = 'block';
          this.state = 'patrol';
          this.bounceStack = 0;
          this.landTimer = null;
        }, 350); // match CSS transition duration
      }, JUMP_DURATION);
    }

    _loop(now) {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      if (this.state === 'patrol') {
        this.frameTimer += dt * 1000;
        if (this.frameTimer >= FRAME_INTERVAL) {
          this.frameTimer -= FRAME_INTERVAL;
          this.frameIdx = (this.frameIdx + 1) % FRAME_COUNT;
        }
        const dir = this.facingRight ? 1 : -1;
        this.x += SPEED * dt * dir;
        if (this.x >= this.rightBound) { this.x = this.rightBound; this.facingRight = false; }
        else if (this.x <= this.leftBound) { this.x = this.leftBound; this.facingRight = true; }
      }

      else if (this.state === 'battle') {
        const elapsed = now - (this.battleRiseStart || now);
        if (this.battlePhase === 'rise') {
          // Rise over 2 seconds with ease-out
          const t = Math.min(elapsed / 2000, 1);
          const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
          this.x = this.battlePrevX + (this.battleTargetX - this.battlePrevX) * ease;
          this.baseY = this.battlePrevY + (this.battleTargetY - this.battlePrevY) * ease;
          if (t >= 1) {
            this.battlePhase = 'strike';
            this.battleStrikeTime = now;
            this.battleTargetEl.classList.add('todo--shatter');
            // Shake battle image
            this.spriteEl.classList.add('pet--shake');
            // Spawn sparks & particles
            this._spawnSparks(this.battleTargetRect);
            this._spawnParticles(this.battleTargetRect);
          }
        } else if (this.battlePhase === 'strike') {
          // Hold at target for 500ms
          if (now - this.battleStrikeTime > 500) {
            this.battlePhase = 'fall';
            this.battleFallStart = now;
          }
        } else if (this.battlePhase === 'fall') {
          // Fall back over 1.5 seconds with ease-in
          const t = Math.min((now - this.battleFallStart) / 1500, 1);
          const ease = t * t * t; // ease-in cubic
          this.x = this.battleTargetX + (this.battlePrevX - this.battleTargetX) * ease;
          this.baseY = this.battleTargetY + (this.battlePrevY - this.battleTargetY) * ease;
          if (t >= 1) {
            this.x = this.battlePrevX;
            this.baseY = this.battlePrevY;
            this.battleTargetEl.classList.remove('todo--shatter');
            this.spriteEl.classList.remove('pet--shake');
            this.spriteEl.style.backgroundImage = '';
            this.spriteEl.style.backgroundSize = '';
            this.spriteEl.style.backgroundPosition = '';
            this.spriteEl.style.backgroundRepeat = '';
            // Restore walk size
            this.spriteEl.style.width = PET_W + 'px';
            this.spriteEl.style.height = PET_H + 'px';
            this.spriteWrap.style.width = PET_W + 'px';
            this.spriteWrap.style.height = PET_H + 'px';
            this.state = 'patrol';
            this.battleTargetEl = null;
          }
        }
      }

      this._render();
      requestAnimationFrame(this._loop);
    }

    _render() {
      const flip = this.facingRight ? 'scaleX(-1)' : 'scaleX(1)';
      this.container.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.baseY)}px)`;
      this.spriteWrap.style.transform = flip;
      // Walk sprite frame — skip during battle (uses battle image instead)
      if (this.state !== 'battle') {
        this.spriteEl.style.backgroundPositionX = (-this.frameIdx * FRAME_W) + 'px';
      }
    }

    /* ── battle: rise from patrol to target, shatter, fall back ── */
    battle(targetEl) {
      if (!targetEl || this.state === 'battle') return;

      if (this.jumpTimer) { clearTimeout(this.jumpTimer); this.jumpTimer = null; }
      if (this.landTimer) { clearTimeout(this.landTimer); this.landTimer = null; }

      // Save patrol position
      this.battlePrevX = this.x;
      this.battlePrevY = this.baseY;

      // Target: center on the todo item
      const targetRect = targetEl.getBoundingClientRect();
      this.battleTargetRect = targetRect;
      this.battleTargetEl = targetEl;
      this.battleTargetX = targetRect.left + targetRect.width / 2 - BATTLE_W / 2;
      this.battleTargetY = targetRect.top + targetRect.height / 2 - BATTLE_H / 2;
      this.battlePhase = 'rise';   // rise → strike → fall
      this.battleRiseStart = performance.now();

      this.state = 'battle';

      // Ensure walk sprite layer is visible
      this.spriteWrap.style.display = 'block';
      this.jumpWrap.style.display = 'none';

      // Face toward todo
      this.facingRight = this.battleTargetX > this.x;

      // Enlarge for battle mode
      this.spriteEl.style.width = BATTLE_W + 'px';
      this.spriteEl.style.height = BATTLE_H + 'px';
      this.spriteWrap.style.width = BATTLE_W + 'px';
      this.spriteWrap.style.height = BATTLE_H + 'px';

      // Switch to battle image
      this.spriteEl.style.backgroundImage = `url('${BATTLE_IMG}')`;
      this.spriteEl.style.backgroundSize = 'contain';
      this.spriteEl.style.backgroundPosition = 'center';
      this.spriteEl.style.backgroundRepeat = 'no-repeat';
    }

    /* ── VFX helpers ────────────────────────────── */
    _spawnSparks(rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const colors = ['#ff6600', '#ffaa00', '#ff3300', '#ffcc00', '#fff'];
      for (let i = 0; i < 12; i++) {
        const spark = document.createElement('div');
        spark.className = 'pet-spark';
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.5;
        const dist = 30 + Math.random() * 40;
        spark.style.cssText = `
          left: ${cx}px; top: ${cy}px;
          width: 4px; height: 4px;
          background: ${colors[i % colors.length]};
          --sx: ${Math.cos(angle) * dist}px;
          --sy: ${Math.sin(angle) * dist}px;
        `;
        document.body.appendChild(spark);
        setTimeout(() => spark.remove(), 500);
      }
    }

    _spawnParticles(rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      for (let i = 0; i < 8; i++) {
        const p = document.createElement('div');
        p.className = 'pet-particle';
        const angle = Math.random() * Math.PI * 2;
        const dist = 50 + Math.random() * 60;
        const size = 6 + Math.random() * 8;
        p.style.cssText = `
          left: ${cx}px; top: ${cy}px;
          width: ${size}px; height: ${size}px;
          --sx: ${Math.cos(angle) * dist}px;
          --sy: ${Math.sin(angle) * dist}px;
        `;
        document.body.appendChild(p);
        setTimeout(() => p.remove(), 600);
      }
    }

    celebrate() {
      // Reserved for other triggers
    }

    destroy() {
      if (this.jumpTimer) clearTimeout(this.jumpTimer);
      this.container.removeEventListener('click', this._onClick);
      window.removeEventListener('resize', this._calcBounds);
      this.container.remove();
    }
  }

  function init() {
    const container = document.getElementById('pet-container');
    if (!container) return;
    window.__pochitaPet = new PochitaPet(container);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
