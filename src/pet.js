/* ─── 波奇塔桌面宠物 v2.1 — 单图巡逻 ──────────── */
(function () {
  'use strict';

  const PET_W = 100;           // display width (px)
  const PET_H = 100;
  const SPEED = 40;           // patrol speed (px/s)
  const JUMP_DURATION = 500;  // ms

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
      this.lastTime = performance.now();
      this.jumpTimer = null;

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
      this.jumpWrap.style.width = PET_W + 'px';
      this.jumpWrap.style.height = PET_H + 'px';
      this.jumpImg.style.width = PET_W + 'px';
      this.jumpImg.style.height = PET_H + 'px';

      this.container.addEventListener('click', this._onClick);
      this.container.addEventListener('pointerdown', (e) => e.stopPropagation());

      this._calcBounds();
      window.addEventListener('resize', () => this._calcBounds());

      this.x = this.leftBound + (this.rightBound - this.leftBound) / 2;
      this.lastTime = performance.now();
      requestAnimationFrame(this._loop);
    }

    _calcBounds() {
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
      if (this.state === 'jump') return;

      this.state = 'jump';
      this.spriteWrap.style.display = 'none';
      this.jumpWrap.style.display = 'block';
      this.jumpWrap.style.transform = this.facingRight ? 'scaleX(1)' : 'scaleX(-1)';

      this.jumpImg.classList.remove('pet--bounce');
      void this.jumpImg.offsetWidth;
      this.jumpImg.classList.add('pet--bounce');

      if (this.jumpTimer) clearTimeout(this.jumpTimer);
      this.jumpTimer = setTimeout(() => {
        this.jumpImg.classList.remove('pet--bounce');
        this.jumpWrap.style.display = 'none';
        this.spriteWrap.style.display = 'block';
        this.state = 'patrol';
      }, JUMP_DURATION);
    }

    _loop(now) {
      const dt = Math.min((now - this.lastTime) / 1000, 0.1);
      this.lastTime = now;

      if (this.state === 'patrol') {
        const dir = this.facingRight ? 1 : -1;
        this.x += SPEED * dt * dir;

        if (this.x >= this.rightBound) {
          this.x = this.rightBound;
          this.facingRight = false;
        } else if (this.x <= this.leftBound) {
          this.x = this.leftBound;
          this.facingRight = true;
        }
      }

      this._render();
      requestAnimationFrame(this._loop);
    }

    _render() {
      const flip = this.facingRight ? 'scaleX(1)' : 'scaleX(-1)';
      this.container.style.transform = `translate(${Math.round(this.x)}px, ${Math.round(this.baseY)}px)`;
      this.spriteWrap.style.transform = flip;
    }

    celebrate() {}

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
