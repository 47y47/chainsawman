// ─── Electron API ───────────────────────────────
const api = () => window.chainsawAPI;

// ─── State ──────────────────────────────────────
let currentYear, currentWeek;
let todos = [];
let editingId = null;

// ─── Init ───────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const now = new Date();
  const iso = getISOWeek(now);
  currentYear = iso.year;
  currentWeek = iso.week;
  updateWeekLabel();
  loadTodos();

  // Window controls
  document.getElementById('btn-minimize').addEventListener('click', () => {
    try { api().minimizeWindow(); } catch (e) {}
  });
  document.getElementById('btn-close').addEventListener('click', () => {
    try { api().closeWindow(); } catch (e) {}
  });

  // Navigation
  document.getElementById('btn-prev-week').addEventListener('click', prevWeek);
  document.getElementById('btn-next-week').addEventListener('click', nextWeek);
  document.getElementById('btn-today').addEventListener('click', goToday);
  document.getElementById('btn-add').addEventListener('click', openAddModal);
  document.getElementById('btn-summary').addEventListener('click', openSummary);
  document.getElementById('btn-modal-cancel').addEventListener('click', closeModal);
  document.getElementById('btn-modal-confirm').addEventListener('click', confirmModal);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeModal();
  });
  document.getElementById('scoring-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeScoring();
  });
  document.getElementById('summary-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) closeSummary();
  });
  document.getElementById('btn-summary-close').addEventListener('click', closeSummary);
  document.addEventListener('click', hideContextMenu);

  api().getSetting({ key: 'muted' }).then(val => { isMuted = val === 'true'; }).catch(() => {});
  checkRecurring();
});

// ─── ISO Week Calculation ──────────────────────
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

function formatWeek(year, week) {
  const simple = new Date(Date.UTC(year, 0, 1 + (week - 1) * 7));
  const dayOfWeek = simple.getUTCDay() || 7;
  const monday = new Date(simple);
  monday.setUTCDate(simple.getUTCDate() - dayOfWeek + 1);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);

  const fmt = (d) => `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
  return `${year}年 ${fmt(monday)} - ${fmt(sunday)}`;
}

// ─── Navigation ────────────────────────────────
function updateWeekLabel() {
  document.getElementById('week-label').textContent = formatWeek(currentYear, currentWeek);
}

function prevWeek() {
  currentWeek--;
  if (currentWeek < 1) { currentYear--; currentWeek = 52; }
  updateWeekLabel();
  loadTodos();
}

function nextWeek() {
  currentWeek++;
  if (currentWeek > 52) { currentYear++; currentWeek = 1; }
  updateWeekLabel();
  loadTodos();
}

function goToday() {
  const iso = getISOWeek(new Date());
  currentYear = iso.year;
  currentWeek = iso.week;
  updateWeekLabel();
  loadTodos();
}

// ─── Load & Render ─────────────────────────────
async function loadTodos() {
  try {
    todos = await api().getTodos({ year: currentYear, weekNumber: currentWeek });
  } catch (e) {
    console.error('Failed to load todos:', e);
    todos = [];
  }
  renderTodos();
}

function renderTodos() {
  const list = document.getElementById('todo-list');
  if (todos.length === 0) {
    list.innerHTML = `<div style="text-align:center; color:var(--text-secondary); padding:40px 0;">
      暂无契约<br><small>订立新的契约吧</small>
    </div>`;
    return;
  }

  list.innerHTML = todos.map(todo => `
    <div class="todo-item ${todo.status === 'completed' ? 'todo-item--completed' : ''}"
         data-id="${todo.id}"
         data-status="${todo.status}"
         data-type="${todo.todo_type}">
      <div class="todo-item__pull-assembly ${todo.status === 'completed' ? '' : 'js-handle'}"
           data-id="${todo.id}"
           title="${todo.status === 'completed' ? '已讨伐' : '下拉讨伐'}">
        <div class="todo-item__handle">
          <svg viewBox="0 0 28 28" width="26" height="26" class="todo-item__handle-svg">
            <polygon points="14,3 3,23 25,23" fill="none" stroke="#1a1a1a" stroke-width="2.5" stroke-linejoin="round"/>
            <polygon points="14,7 7,21 21,21" fill="none" stroke="#444" stroke-width="1.2" stroke-linejoin="round" opacity="0.5"/>
            <circle cx="14" cy="23" r="2.2" fill="#1a1a1a"/>
          </svg>
        </div>
      </div>
      <span class="todo-item__text">
        ${escapeHtml(todo.title)}
        ${todo.status === 'completed' ? renderScratch() : ''}
      </span>
      <span class="todo-item__badge todo-item__badge--${todo.todo_type}">
        ${typeLabel(todo.todo_type)}
      </span>
      ${todo.remind_at ? `<span class="todo-item__remind">${todo.remind_at}</span>` : ''}
      ${todo.status === 'completed' && todo.score != null ? `<span class="todo-item__score">评分 ${todo.score}</span>` : ''}
    </div>
  `).join('');

  document.querySelectorAll('.js-handle').forEach(assembly => {
    attachPullCord(assembly);
  });

  document.querySelectorAll('.todo-item').forEach(item => {
    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      showContextMenu(e.clientX, e.clientY, parseInt(item.dataset.id));
    });
  });
}

function typeLabel(type) {
  return { daily: '每日契约', weekly: '每周讨伐', normal: '一般任务' }[type] || type;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderScratch() {
  return `<span class="scratch-mark">
    <svg viewBox="0 0 100 14" preserveAspectRatio="none">
      <!-- Chainsaw teeth cut: jagged zigzag slash -->
      <path d="M0,6 L8,3 L15,7 L22,4 L30,8 L38,5 L46,9 L54,4 L62,8 L70,3 L78,7 L85,4 L92,8 L100,5"
        stroke="#999" stroke-width="3.5" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.8"/>
      <!-- Inner highlight for torn-edge depth -->
      <path d="M0,5.5 L8,2.5 L15,6.5 L22,3.5 L30,7.5 L38,4.5 L46,8.5 L54,3.5 L62,7.5 L70,2.5 L78,6.5 L85,3.5 L92,7.5 L100,4.5"
        stroke="#bbb" stroke-width="1.2" fill="none" stroke-linejoin="round" stroke-linecap="round" opacity="0.5"/>
    </svg>
  </span>`;
}

// ─── Pull Cord Interaction ─────────────────────
function attachPullCord(assembly) {
  let startX = 0, startY = 0;
  let dragX = 0, dragY = 0;
  let isDragging = false;
  const THRESHOLD = 100;
  const MAX_DIST = 150;
  const handle = assembly.querySelector('.todo-item__handle');
  let cableSvg = null;

  function createCable() {
    if (cableSvg) return;
    cableSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    cableSvg.setAttribute('class', 'todo-item__cable');
    cableSvg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:1;';

    const ns = 'http://www.w3.org/2000/svg';
    const defs = document.createElementNS(ns, 'defs');
    const grad = document.createElementNS(ns, 'linearGradient');
    grad.id = 'cable-grad-' + assembly.dataset.id;
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0');
    grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');

    const stop1 = document.createElementNS(ns, 'stop');
    stop1.setAttribute('offset', '0%'); stop1.setAttribute('stop-color', '#1a1a1a');
    const stop2 = document.createElementNS(ns, 'stop');
    stop2.setAttribute('offset', '100%'); stop2.setAttribute('stop-color', '#1a1a1a');
    grad.appendChild(stop1); grad.appendChild(stop2);
    defs.appendChild(grad);
    cableSvg.appendChild(defs);

    const cablePath = document.createElementNS(ns, 'path');
    cablePath.classList.add('todo-item__cable-path');
    cablePath.setAttribute('stroke', `url(#cable-grad-${assembly.dataset.id})`);
    cablePath.setAttribute('stroke-width', '3');
    cablePath.setAttribute('fill', 'none');
    cablePath.setAttribute('stroke-linecap', 'round');
    cableSvg.appendChild(cablePath);

    const shadowPath = document.createElementNS(ns, 'path');
    shadowPath.classList.add('todo-item__cable-shadow');
    shadowPath.setAttribute('stroke', 'rgba(0,0,0,0.12)');
    shadowPath.setAttribute('stroke-width', '1.5');
    shadowPath.setAttribute('fill', 'none');
    shadowPath.setAttribute('stroke-linecap', 'round');
    cableSvg.appendChild(shadowPath);

    assembly.insertBefore(cableSvg, handle);
  }

  function updateCable(dx, dy) {
    if (!cableSvg) return;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const tension = Math.min(dist / THRESHOLD, 1);

    const grad = cableSvg.querySelector('linearGradient');
    const stops = grad.querySelectorAll('stop');
    const r = Math.round(74 + tension * (196 - 74));
    const g = Math.round(74 + tension * (30 - 74));
    const b = Math.round(74 + tension * (58 - 74));
    stops[0].setAttribute('stop-color', `rgb(${r},${g},${b})`);
    stops[1].setAttribute('stop-color', `rgb(${r},${g},${b})`);

    const ax = 20, ay = 4;
    const hx = 20 + dx, hy = 4 + dy;
    const cx = 20 + dx * 0.55, cy = 4 + dy * 0.55;
    const d = `M${ax},${ay} Q${cx},${cy} ${hx},${hy}`;
    cableSvg.querySelector('.todo-item__cable-path').setAttribute('d', d);
    cableSvg.querySelector('.todo-item__cable-shadow').setAttribute('d', d);

    const width = 3 + tension * 1.5;
    cableSvg.querySelector('.todo-item__cable-path').setAttribute('stroke-width', width);
    cableSvg.querySelector('.todo-item__cable-shadow').setAttribute('stroke-width', Math.max(1, width - 1.5));
  }

  function removeCable() {
    if (cableSvg && cableSvg.parentNode) {
      cableSvg.remove();
      cableSvg = null;
    }
  }

  assembly.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    dragX = 0; dragY = 0;
    handle.style.transition = 'none';
    handle.style.transform = '';
    handle.style.transformOrigin = 'top center';
    createCable();
    updateCable(0, 0);
    document.body.classList.add('shaking');
    e.preventDefault();
  });

  const onMove = (e) => {
    if (!isDragging) return;
    let dx = e.clientX - startX;
    let dy = e.clientY - startY;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > MAX_DIST) {
      const ratio = MAX_DIST / dist;
      dx *= ratio;
      dy *= ratio;
    }
    dragX = dx; dragY = dy;

    const angle = Math.atan2(-dx, dy) * 180 / Math.PI;
    handle.style.transform = `translate(${dx}px, ${dy}px) rotate(${angle}deg)`;
    updateCable(dx, dy);

    if (dist >= THRESHOLD) {
      handle.style.filter = 'drop-shadow(0 0 4px var(--accent)) drop-shadow(0 0 8px rgba(196,30,58,0.5))';
    } else {
      handle.style.filter = '';
    }
  };

  const onUp = () => {
    if (!isDragging) return;
    isDragging = false;
    document.body.classList.remove('shaking');
    handle.style.filter = '';

    const dist = Math.sqrt(dragX * dragX + dragY * dragY);
    if (dist >= THRESHOLD) {
      const id = parseInt(assembly.dataset.id);
      playEngineSound();
      triggerComplete(id);
    }

    handle.style.transition = 'transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)';
    handle.style.transform = 'translate(0, 0) rotate(0deg)';

    const cleanup = () => {
      handle.style.transition = '';
      handle.style.transform = '';
      handle.style.transformOrigin = '';
      removeCable();
      handle.removeEventListener('transitionend', cleanup);
    };
    handle.addEventListener('transitionend', cleanup);
    setTimeout(() => {
      if (cableSvg) cleanup();
    }, 350);
  };

  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', () => {
    if (isDragging) onUp();
  });
}

// ─── Audio ──────────────────────────────────────
let chainsawAudio = null;

function playEngineSound() {
  if (isMuted) return;
  try {
    if (!chainsawAudio) {
      chainsawAudio = new Audio('../assets/combined_full.mp3');
    }
    chainsawAudio.currentTime = 0;
    chainsawAudio.play().catch(e => console.warn('Audio play failed:', e));
    setTimeout(() => {
      if (chainsawAudio) {
        chainsawAudio.pause();
        chainsawAudio.currentTime = 0;
      }
    }, 10000);
  } catch (e) { console.warn('Audio failed:', e); }
}

// ─── Complete & Score ──────────────────────────
let pendingCompleteId = null;
let scoringLocked = false;
let selectedScore = 0;

function triggerComplete(id) {
  pendingCompleteId = id;
  scoringLocked = false;
  selectedScore = 0;
  renderScoringBoxes(0);
  document.getElementById('scoring-overlay').classList.remove('hidden');
}

// Daisy SVG (petals only, no leaves)
function daisySVG() {
  const petals = [0, 45, 90, 135, 180, 225, 270, 315].map(deg =>
    `<ellipse cx="12" cy="4" rx="3.5" ry="7" transform="rotate(${deg},12,12)" fill="#fff" stroke="#ccc" stroke-width="0.5" opacity="0.9"/>`
  ).join('');
  return `<svg viewBox="0 0 24 24" width="22" height="22">${petals}<circle cx="12" cy="12" r="4" fill="#c4956b"/><circle cx="12" cy="12" r="3" fill="#d4a574"/></svg>`;
}

function onScoringMouseLeave() {
  if (scoringLocked) return;
  renderScoringBoxes(selectedScore);
}

function renderScoringBoxes(previewEnd) {
  const container = document.getElementById('scoring-boxes');
  let html = '';
  for (let i = 1; i <= 10; i++) {
    const filled = i <= previewEnd;
    const locked = scoringLocked && i === selectedScore;
    html += `<div class="scoring__box ${filled ? 'scoring__box--filled' : ''} ${locked ? 'scoring__box--locked' : ''}"
                  data-score="${i}">${filled ? daisySVG() : ''}</div>`;
  }
  container.innerHTML = html;

  container.querySelectorAll('.scoring__box').forEach(box => {
    const score = parseInt(box.dataset.score);

    box.addEventListener('mouseenter', () => {
      if (scoringLocked) return;
      renderScoringBoxes(score);
    });

    box.addEventListener('mousedown', (e) => {
      e.preventDefault();
      scoringLocked = true;
      selectedScore = score;
      renderScoringBoxes(score);
    });
  });

  container.removeEventListener('mouseleave', onScoringMouseLeave);
  container.addEventListener('mouseleave', onScoringMouseLeave);
}

document.getElementById('btn-scoring-confirm').addEventListener('click', async () => {
  const score = selectedScore;
  const completedId = pendingCompleteId; // save before closeScoring clears it

  if (completedId) {
    try {
      await api().completeTodo({ id: completedId, score });
    } catch (e) { console.error('Failed to complete todo:', e); }
  }

  closeScoring();
  await loadTodos();

  // Trigger Pochita battle charge toward the completed todo
  if (completedId) {
    setTimeout(() => {
      const target = document.querySelector(`.todo-item[data-id="${completedId}"]`);
      if (target && window.__pochitaPet) {
        window.__pochitaPet.battle(target);
      }
    }, 200); // small delay so DOM is settled
  }
});

function closeScoring() {
  document.getElementById('scoring-overlay').classList.add('hidden');
  pendingCompleteId = null;
  scoringLocked = false;
  selectedScore = 0;
}

// ─── Modal (Add/Edit) ──────────────────────────
function openAddModal() {
  editingId = null;
  document.getElementById('modal-title').textContent = '新契约';
  document.getElementById('modal-input').value = '';
  document.getElementById('modal-type').value = 'normal';
  document.getElementById('modal-remind').value = '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-input').focus();
}

function openEditModal(todo) {
  editingId = todo.id;
  document.getElementById('modal-title').textContent = '修改契约';
  document.getElementById('modal-input').value = todo.title;
  document.getElementById('modal-type').value = todo.todo_type;
  document.getElementById('modal-remind').value = todo.remind_at || '';
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.getElementById('modal-input').focus();
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  editingId = null;
}

async function confirmModal() {
  const title = document.getElementById('modal-input').value.trim();
  if (!title) return;
  const todoType = document.getElementById('modal-type').value;
  const remindAt = document.getElementById('modal-remind').value || null;

  if (editingId) {
    try { await api().updateTodo({ id: editingId, title, todoType, remindAt }); } catch (e) {}
  } else {
    try { await api().addTodo({ title, todoType, remindAt }); } catch (e) {}
  }

  closeModal();
  loadTodos();
}

// ─── Context Menu ──────────────────────────────
let contextTodoId = null;

function showContextMenu(x, y, id) {
  contextTodoId = id;
  const menu = document.getElementById('context-menu');
  menu.style.left = x + 'px';
  menu.style.top = y + 'px';
  menu.classList.remove('hidden');
}

function hideContextMenu() {
  document.getElementById('context-menu').classList.add('hidden');
}

document.getElementById('context-menu').addEventListener('click', async (e) => {
  const action = e.target.dataset.action;
  if (!action || !contextTodoId) return;
  hideContextMenu();

  const todo = todos.find(t => t.id === contextTodoId);
  if (!todo) return;

  if (action === 'edit') {
    openEditModal(todo);
  } else if (action === 'delete') {
    try { await api().deleteTodo({ id: contextTodoId }); } catch (e) {}
    loadTodos();
  }
});

// ─── Summary ───────────────────────────────────
async function openSummary() {
  document.getElementById('summary-overlay').classList.remove('hidden');
  try {
    const summary = await api().getSummary({ year: currentYear, weekNumber: currentWeek });
    renderSummary(summary);
  } catch (e) { console.error('Failed to get summary:', e); }
}

function renderSummary(summary) {
  const avgRounded = Math.round(summary.avgScore);
  const dialogue = getMakimaDialogue(avgRounded, summary);

  document.getElementById('summary-content').innerHTML = `
    <div class="summary__score">${summary.avgScore.toFixed(1)}</div>
    <div style="color:var(--text-secondary); font-size:13px;">本周平均评分</div>
    <div class="summary__makima" id="makima-img">
      <span>Q版玛奇玛<br>(${avgRounded}分)</span>
    </div>
    <div class="summary__dialogue">"${escapeHtml(dialogue)}"</div>
    <div class="summary__stats">
      <span>讨伐 ${summary.completedCount}/${summary.totalCount}</span>
      ${summary.maxScore != null ? `<span>最高评分 ${summary.maxScore}</span>` : ''}
      ${summary.minScore != null ? `<span>最低评分 ${summary.minScore}</span>` : ''}
    </div>
  `;

  loadMakimaImage(avgRounded);
}

function loadMakimaImage(score) {
  const img = new Image();
  img.src = `../assets/images/makima_${score}.png`;
  img.onload = () => {
    const container = document.getElementById('makima-img');
    if (container) { container.innerHTML = ''; container.appendChild(img); }
  };
}

function getMakimaDialogue(score, summary) {
  const dialogues = [
    "今天的你……大概连狗的饲料都不值得吃呢。",
    "我以为养的是猎犬……结果只是仓鼠吗。",
    "电次君的话，就算只剩一个脑袋也会完成任务的。你比他完整那么多……却只做了这么点？",
    "不会做的事情，我可以教你。但你不做……是态度问题哦。",
    "有一点在动了。但还不够让我记住你的脸。",
    "及格。给你狗粮，要吗？",
    "好狗。继续这样保持。",
    "嗯，就是这样。你完成任务的姿态……很好看哦。",
    "今天做得不错。作为奖励……我记住你的名字了。",
    "太好了。没有你完成不了的任务，也没有你辜负的期待。",
    "满分呢。果然……我没有看错你。",
  ];

  if (summary.completedCount > 0 && summary.avgScore === 10.0) {
    return "你愿意一直为我工作吗？不需要回答。因为——你已经是我的了。";
  }

  return dialogues[score] || dialogues[5];
}

function closeSummary() {
  document.getElementById('summary-overlay').classList.add('hidden');
}

// ─── Settings ───────────────────────────────────
let isMuted = false;

async function openSettings() {
  document.getElementById('settings-overlay').classList.remove('hidden');
  try {
    const mutedVal = await api().getSetting({ key: 'muted' });
    isMuted = mutedVal === 'true';
    updateToggle('btn-mute-toggle', isMuted);

    const autoVal = await api().getAutoLaunch();
    updateToggle('btn-autostart-toggle', autoVal);
  } catch (e) { console.error('Failed to load settings:', e); }
}

function updateToggle(btnId, isOn) {
  const btn = document.getElementById(btnId);
  btn.textContent = isOn ? '开' : '关';
  btn.classList.toggle('settings__toggle--on', isOn);
}

document.getElementById('btn-mute-toggle').addEventListener('click', async () => {
  isMuted = !isMuted;
  try { await api().setSetting({ key: 'muted', value: String(isMuted) }); } catch (e) { console.error('Failed to save mute setting:', e); }
  updateToggle('btn-mute-toggle', isMuted);
});

document.getElementById('btn-autostart-toggle').addEventListener('click', async () => {
  try {
    const current = await api().getAutoLaunch();
    const success = await api().setAutoLaunch(!current);
    if (success) {
      updateToggle('btn-autostart-toggle', !current);
    }
  } catch (e) { console.error('Failed to toggle auto-start:', e); }
});

document.getElementById('btn-settings-close').addEventListener('click', () => {
  document.getElementById('settings-overlay').classList.add('hidden');
});

document.getElementById('settings-overlay').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) {
    document.getElementById('settings-overlay').classList.add('hidden');
  }
});

// Wire settings button
document.getElementById('btn-settings').addEventListener('click', openSettings);

// ─── Recurring Check ───────────────────────────
async function checkRecurring() {
  try {
    const refreshed = await api().checkRecurring();
    if (refreshed && refreshed.length > 0) { todos = refreshed; renderTodos(); }
  } catch (e) { console.error('Recurring check failed:', e); }
}

// ─── Reminder Check (poll every 30 seconds) ────
setInterval(async () => {
  try {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const active = todos.filter(t => t.status === 'active' && t.remind_at === timeStr);
    for (const todo of active) {
      try { await api().showNotification({ title: '电锯人待办提醒', body: todo.title }); } catch (e) {}
    }
  } catch (e) {}
}, 30000);
