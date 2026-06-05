/* ─── 波奇塔桌面宠物 v2.2 — 8 帧精灵动画 ──────── */
(function () {
  'use strict';

  const PET_W = 80;            // walk display width (px)
  const PET_H = 80;            // walk display height
  const JUMP_W = 100;          // jump display width
  const JUMP_H = 100;          // jump display height
  const BATTLE_W = 150;         // battle display width
  const BATTLE_H = 104;         // battle display height (from sprite, scaled)
  const BATTLE_FC = 8;          // battle frame count
  const BATTLE_FW = 150;        // battle frame width
  const BATTLE_FI = 100;        // battle frame interval (ms)
  const SPEED = 40;            // patrol speed (px/s)
  const FRAME_COUNT = 8;       // walk frames in sprite sheet
  const FRAME_W = 80;          // single frame display width
  const FRAME_INTERVAL = 120;  // ms per frame (~8.3 fps)
  const JUMP_DURATION = 500;
  const BATTLE_IMG = '../assets/images/pochita_battle.png';
  const BATTLE_SPRITE = '../assets/images/pochita_battle_walk.png';
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
        // Battle frame cycling (only during strike phase)
        if (this.battleAnimPlaying) {
          this.frameTimer += dt * 1000;
          if (this.frameTimer >= BATTLE_FI) {
            this.frameTimer -= BATTLE_FI;
            this.frameIdx = (this.frameIdx + 1) % BATTLE_FC;
          }
        }

        const elapsed = now - (this.battleRiseStart || now);
        if (this.battlePhase === 'rise') {
          // Rise over 2 seconds with ease-out
          const t = Math.min(elapsed / 2000, 1);
          const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
          this.x = this.battlePrevX + (this.battleTargetX - this.battlePrevX) * ease;
          this.baseY = this.battlePrevY + (this.battleTargetY - this.battlePrevY) * ease;
          if (t >= 1) {
            this.battlePhase = 'strike';
            this.battleStrikeTime = now + 300; // 300ms hold before first strike
            this.battleCrackLevel = 0;
            this.battleFinalDone = false;
            // Switch to battle sprite sheet
            this.spriteEl.style.backgroundImage = `url('${BATTLE_SPRITE}')`;
            this.spriteEl.style.backgroundSize = (BATTLE_FW * BATTLE_FC) + 'px ' + BATTLE_H + 'px';
            this.spriteEl.style.backgroundPosition = '0 0';
            this.frameIdx = 0;
            this.frameTimer = 0;
            this.battleAnimPlaying = true; // play continuously through all strikes
          }
        } else if (this.battlePhase === 'strike') {
          // Multi-strike: attack(0.35s) → pause(0.15s) → attack → pause → attack → final(0.4s)
          // Animation plays continuously, cracks progress on each attack
          const strikeElapsed = now - this.battleStrikeTime;
          const ATK = 350, PAUSE = 500;
          const fullCycle = ATK + PAUSE;
          const totalStrikes = 5; // 4 cracks + 1 break

          const cycleIdx = Math.floor(strikeElapsed / fullCycle);
          const inCycle = strikeElapsed % fullCycle;
          const attackStart = inCycle < ATK;

          if (cycleIdx < totalStrikes && attackStart && this.battleCrackLevel !== cycleIdx + 1) {
            const strikeNum = cycleIdx + 1;
            this.battleCrackLevel = strikeNum;
            this.spriteEl.classList.add('pet--shake');
            if (window.playStrikeSound) window.playStrikeSound();
            setTimeout(() => this.spriteEl.classList.remove('pet--shake'), 300);

            if (strikeNum < totalStrikes) {
              this._drawCracks(strikeNum);
              this._spawnSparks(this.battleTargetRect);
            } else {
              this.battleFinalDone = true;
              this._drawCracks('break');
              this._spawnShards(this.battleOverlay.getBoundingClientRect());
              this._spawnSparks(this.battleTargetRect);
              this._spawnParticles(this.battleTargetRect);
              if (window.playStrikeSound) window.playStrikeSound();
              setTimeout(() => {
                if (this.state === 'battle' && this.battlePhase === 'strike') {
                  this.battlePhase = 'fall';
                  this.battleFallStart = performance.now();
                  this.battleAnimPlaying = false;
                  this.spriteEl.classList.remove('pet--shake');
                  this.spriteEl.style.backgroundImage = `url('${BATTLE_IMG}')`;
                  this.spriteEl.style.backgroundSize = 'contain';
                  this.spriteEl.style.backgroundPosition = 'center';
                }
              }, 600);
            }
          }
        } else if (this.battlePhase === 'fall') {
          // Fall back over 1.5 seconds with ease-in, no animation
          const t = Math.min((now - this.battleFallStart) / 1500, 1);
          const ease = t * t * t;
          this.x = this.battleTargetX + (this.battlePrevX - this.battleTargetX) * ease;
          this.baseY = this.battleTargetY + (this.battlePrevY - this.battleTargetY) * ease;
          if (t >= 1) {
            this.x = this.battlePrevX;
            this.baseY = this.battlePrevY;
            // Cleanup
            this.spriteEl.classList.remove('pet--shake');
            this.spriteEl.style.backgroundImage = '';
            this.spriteEl.style.backgroundSize = '';
            this.spriteEl.style.backgroundPosition = '';
            this.spriteEl.style.backgroundRepeat = '';
            this.spriteEl.style.width = PET_W + 'px';
            this.spriteEl.style.height = PET_H + 'px';
            this.spriteWrap.style.width = PET_W + 'px';
            this.spriteWrap.style.height = PET_H + 'px';
            this.frameIdx = 0;
            this.frameTimer = 0;
            // Remove battle overlay if created
            if (this.battleOverlay) {
              this.battleOverlay.remove();
              this.battleOverlay = null;
            }
            this.state = 'patrol';
            this.battleTargetEl = null;
            // Restore original element opacity
            if (this._battleOriginalEl) {
              this._battleOriginalEl.style.opacity = '';
              this._battleOriginalEl = null;
            }
            // Callback: refresh list etc.
            if (this.battleOnDone) { this.battleOnDone(); this.battleOnDone = null; }
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
      // Frame position — only update when animating
      if (this.state === 'patrol' || (this.state === 'battle' && this.battleAnimPlaying)) {
        const fw = (this.state === 'battle') ? BATTLE_FW : FRAME_W;
        this.spriteEl.style.backgroundPositionX = (-this.frameIdx * fw) + 'px';
      }
    }

    /* ── battle: rise from patrol to target, shatter, fall back ── */
    battle(targetEl, savedRect, onDone) {
      if (!targetEl || this.state === 'battle') return;

      if (this.jumpTimer) { clearTimeout(this.jumpTimer); this.jumpTimer = null; }
      if (this.landTimer) { clearTimeout(this.landTimer); this.landTimer = null; }

      // Save patrol position
      this.battlePrevX = this.x;
      this.battlePrevY = this.baseY;

      // Target rect: use saved if element is detached
      const targetRect = savedRect || targetEl.getBoundingClientRect();
      this.battleTargetRect = targetRect;

      // Always create battle overlay at saved position for crack effects
      const text = targetEl.querySelector('.todo-item__text')?.textContent || '';
      const badgeEl = targetEl.querySelector('.todo-item__badge');
      const badgeClass = badgeEl ? badgeEl.className : '';
      const badgeText = badgeEl ? badgeEl.textContent : '';

      this.battleOverlay = document.createElement('div');
      this.battleOverlay.className = 'todo-item battle-overlay';
      this.battleOverlay.setAttribute('data-type', targetEl.getAttribute('data-type') || 'normal');
      const type = targetEl.getAttribute('data-type') || 'normal';
      this.battleOverlay.innerHTML = `
        <div class="todo-item__pull-assembly" style="flex-shrink:0;width:40px;height:36px;display:flex;align-items:flex-start;justify-content:center;">
          <svg viewBox="0 0 28 28" width="26" height="26"><polygon points="14,3 3,23 25,23" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/><circle cx="14" cy="23" r="2.2" fill="#1a1a1a"/></svg>
        </div>
        <span class="todo-item__text">${text}</span>
        <span class="todo-item__badge todo-item__badge--${type}">${badgeText}</span>
      `;
      this.battleOverlay.style.cssText = `
        position: fixed; left: ${targetRect.left}px; top: ${targetRect.top}px;
        width: ${targetRect.width}px; height: ${targetRect.height}px;
        z-index: 40;
      `;
      // Add SVG layer for crack effects
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'battle-cracks');
      svg.setAttribute('width', targetRect.width);
      svg.setAttribute('height', targetRect.height);
      svg.setAttribute('viewBox', `0 0 ${targetRect.width} ${targetRect.height}`);
      svg.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
      this.battleOverlay.appendChild(svg);
      this.battleCrackSvg = svg;

      document.body.appendChild(this.battleOverlay);
      this.battleTargetEl = this.battleOverlay;
      // Hide original element so it doesn't show after overlay is removed
      if (targetEl && document.contains(targetEl)) {
        targetEl.style.opacity = '0';
        this._battleOriginalEl = targetEl;
      }
      this.battleTargetX = targetRect.left + targetRect.width / 2 - BATTLE_W / 2;
      this.battleTargetY = targetRect.top + targetRect.height / 2 - BATTLE_H / 2;
      this.battlePhase = 'rise';   // rise → strike → fall
      this.battleOnDone = onDone || null;
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

      // Switch to static battle image (sprite animation starts at strike)
      this.battleAnimPlaying = false;
      this.spriteEl.style.backgroundImage = `url('${BATTLE_IMG}')`;
      this.spriteEl.style.backgroundSize = 'contain';
      this.spriteEl.style.backgroundPosition = 'center';
      this.spriteEl.style.backgroundRepeat = 'no-repeat';
      this.frameIdx = 0;
      this.frameTimer = 0;
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

    /* ── SVG crack drawing ──────────────────────── */
    _drawCracks(level) {
      if (!this.battleCrackSvg) return;
      const w = parseInt(this.battleCrackSvg.getAttribute('width'));
      const h = parseInt(this.battleCrackSvg.getAttribute('height'));
      const cx = w / 2, cy = h / 2;
      const ns = 'http://www.w3.org/2000/svg';

      // Don't clear — cracks accumulate
      if (level === 'break') {
        // Final break: shard explosion + red flash
        const r = this.battleOverlay.getBoundingClientRect();
        this._spawnShards(r);
        // Fade out the overlay briefly then remove
        this.battleOverlay.style.transition = 'opacity 0.3s';
        this.battleOverlay.style.opacity = '0';
        setTimeout(() => {
          if (this.battleOverlay) { this.battleOverlay.remove(); this.battleOverlay = null; }
        }, 350);
        return;
      }

      // Each level: one main crack extending in a new direction from center
      // Levels 1-4: cracks spread clockwise around the center
      const mainAngles = [30, 130, 220, 310]; // degrees, spread out
      const angleRad = (mainAngles[level - 1] + (Math.random() - 0.5) * 20) * Math.PI / 180;
      const len = Math.max(w, h) * 0.55;

      // Main crack: center → mid (jagged) → end (branched)
      const endX = cx + Math.cos(angleRad) * len;
      const endY = cy + Math.sin(angleRad) * len;
      const midX = cx + Math.cos(angleRad + 0.15) * len * 0.5;
      const midY = cy + Math.sin(angleRad + 0.15) * len * 0.5;

      const path = document.createElementNS(ns, 'path');
      path.setAttribute('d', `M${cx} ${cy} L${midX} ${midY} L${endX} ${endY}`);
      path.setAttribute('stroke', `rgba(120,15,15,${0.4 + level * 0.15})`);
      path.setAttribute('stroke-width', 1.5 + level * 0.5);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke-linecap', 'round');
      this.battleCrackSvg.appendChild(path);

      // Small branch off the main crack
      const brAngle = angleRad + (Math.random() > 0.5 ? 0.5 : -0.5);
      const brStartX = cx + Math.cos(angleRad) * len * 0.4;
      const brStartY = cy + Math.sin(angleRad) * len * 0.4;
      const brEndX = brStartX + Math.cos(brAngle) * len * 0.3;
      const brEndY = brStartY + Math.sin(brAngle) * len * 0.3;
      const branch = document.createElementNS(ns, 'path');
      branch.setAttribute('d', `M${brStartX} ${brStartY} L${brEndX} ${brEndY}`);
      branch.setAttribute('stroke', `rgba(100,10,10,${0.3 + level * 0.12})`);
      branch.setAttribute('stroke-width', 1 + level * 0.3);
      branch.setAttribute('fill', 'none');
      branch.setAttribute('stroke-linecap', 'round');
      this.battleCrackSvg.appendChild(branch);

      // Subtle glow around cracks
      this.battleOverlay.style.boxShadow =
        `inset 0 0 ${8 + level * 6}px rgba(200,30,30,${0.08 + level * 0.07})`;
    }

    /* ── Shard explosion ─────────────────────────── */
    _spawnShards(rect) {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const colors = ['#f5f0e8', '#e8dcc8', '#ddd5c0', '#c41e3a', '#8b0000', '#d42a45'];
      for (let i = 0; i < 14; i++) {
        const shard = document.createElement('div');
        shard.className = 'pet-shard';
        const w = (20 + Math.random() * 50) * 3;
        const h = (6 + Math.random() * 12) * 3;
        const angle = (Math.PI * 2 * i) / 10 + (Math.random() - 0.5) * 0.5;
        const dist = 50 + Math.random() * 80;
        shard.style.cssText = `
          left: ${cx - w/2}px; top: ${cy - h/2}px;
          width: ${w}px; height: ${h}px;
          background: ${colors[i % colors.length]};
          --sx: ${Math.cos(angle) * dist}px;
          --sy: ${Math.sin(angle) * dist}px;
          --sr: ${(Math.random() - 0.5) * 360}deg;
        `;
        document.body.appendChild(shard);
        setTimeout(() => shard.remove(), 600);
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
