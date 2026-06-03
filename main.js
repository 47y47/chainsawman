const { app, BrowserWindow, Tray, Menu, ipcMain, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const AutoLaunch = require('electron-auto-launch');
const { exec } = require('child_process');

// ─── Database ──────────────────────────────────────
let db;
let dbPath;

function saveDB() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

async function initDB() {
  const SQL = await initSqlJs();
  const userDataPath = app.getPath('userData');
  dbPath = path.join(userDataPath, 'chainsawman.db');

  try {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } catch {
    db = new SQL.Database();
  }

  db.run(`CREATE TABLE IF NOT EXISTS todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    todo_type   TEXT NOT NULL DEFAULT 'normal',
    remind_at   TEXT,
    status      TEXT NOT NULL DEFAULT 'active',
    score       INTEGER,
    completed_at TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    week_year   INTEGER NOT NULL,
    week_number INTEGER NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('muted', 'false')");
  db.run("INSERT OR IGNORE INTO settings (key, value) VALUES ('auto_start', 'true')");

  saveDB();
}

// sql.js query helpers
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const row = stmt.step() ? stmt.getAsObject() : null;
  stmt.free();
  return row;
}

// ─── Window & Tray ─────────────────────────────────
let mainWindow = null;
let tray = null;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 620,
    minWidth: 360,
    minHeight: 480,
    title: '电锯人待办',
    center: true,
    show: false,
    frame: false,
    transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'src', 'index.html'));

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });
}

function createTray() {
  const { nativeImage } = require('electron');
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch (e) {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('电锯人待办');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      },
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow.show();
    mainWindow.focus();
  });
}

// ─── Helpers ────────────────────────────────────────
function getCurrentWeek() {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

// ─── IPC Handlers ───────────────────────────────────
function setupIPC() {
  ipcMain.handle('add-todo', (_, { title, todoType, remindAt }) => {
    const { year, week } = getCurrentWeek();
    db.run(
      'INSERT INTO todos (title, todo_type, remind_at, week_year, week_number) VALUES (?, ?, ?, ?, ?)',
      [title, todoType, remindAt || null, year, week]
    );
    saveDB();
    const result = db.exec('SELECT last_insert_rowid()');
    const newId = result[0].values[0][0];
    return queryOne('SELECT * FROM todos WHERE id = ?', [newId]);
  });

  ipcMain.handle('get-todos', (_, { year, weekNumber }) => {
    return queryAll(
      'SELECT * FROM todos WHERE week_year = ? AND week_number = ? ORDER BY created_at DESC',
      [year, weekNumber]
    );
  });

  ipcMain.handle('update-todo', (_, { id, title, todoType, remindAt }) => {
    if (title !== undefined) {
      db.run('UPDATE todos SET title = ? WHERE id = ?', [title, id]);
    }
    if (todoType !== undefined) {
      db.run('UPDATE todos SET todo_type = ? WHERE id = ?', [todoType, id]);
    }
    if (remindAt !== undefined) {
      db.run('UPDATE todos SET remind_at = ? WHERE id = ?', [remindAt, id]);
    }
    saveDB();
    return { success: true };
  });

  ipcMain.handle('delete-todo', (_, { id }) => {
    db.run('DELETE FROM todos WHERE id = ?', [id]);
    saveDB();
    return { success: true };
  });

  ipcMain.handle('complete-todo', (_, { id, score }) => {
    db.run(
      "UPDATE todos SET status = 'completed', score = ?, completed_at = datetime('now','localtime') WHERE id = ?",
      [score, id]
    );
    saveDB();
    return { success: true };
  });

  ipcMain.handle('get-summary', (_, { year, weekNumber }) => {
    const total = queryOne(
      'SELECT COUNT(*) as count FROM todos WHERE week_year = ? AND week_number = ?',
      [year, weekNumber]
    );
    const completed = queryOne(
      "SELECT COUNT(*) as count FROM todos WHERE week_year = ? AND week_number = ? AND status = 'completed'",
      [year, weekNumber]
    );

    let avgScore = 0;
    let maxScore = null;
    let minScore = null;

    if (completed.count > 0) {
      const scoreRow = queryOne(
        "SELECT AVG(score) as avg, MAX(score) as max, MIN(score) as min FROM todos WHERE week_year = ? AND week_number = ? AND status = 'completed' AND score IS NOT NULL",
        [year, weekNumber]
      );
      avgScore = scoreRow.avg || 0;
      maxScore = scoreRow.max;
      minScore = scoreRow.min;
    }

    return { avgScore, completedCount: completed.count, totalCount: total.count, maxScore, minScore };
  });

  ipcMain.handle('get-completed-todos', (_, { year, weekNumber }) => {
    const rows = queryAll(
      `SELECT title, score, completed_at FROM todos
       WHERE week_year = ? AND week_number = ?
       AND status = 'completed' AND score IS NOT NULL
       ORDER BY completed_at DESC`,
      [year, weekNumber]
    );
    return { todos: rows };
  });

  ipcMain.handle('check-recurring', () => {
    const { year, week } = getCurrentWeek();
    const today = new Date().toISOString().split('T')[0];

    db.run(
      "UPDATE todos SET status = 'active', score = NULL, completed_at = NULL, week_year = ?, week_number = ? WHERE todo_type = 'daily' AND status = 'completed' AND date(completed_at) < date(?)",
      [year, week, today]
    );

    db.run(
      "UPDATE todos SET status = 'active', score = NULL, completed_at = NULL, week_year = ?, week_number = ? WHERE todo_type = 'weekly' AND status = 'completed' AND (week_year < ? OR (week_year = ? AND week_number < ?))",
      [year, week, year, year, week]
    );

    saveDB();
    return queryAll(
      'SELECT * FROM todos WHERE week_year = ? AND week_number = ? ORDER BY created_at DESC',
      [year, week]
    );
  });

  ipcMain.handle('show-notification', (_, { title, body }) => {
    if (Notification.isSupported()) {
      new Notification({ title, body }).show();
    }
  });

  ipcMain.handle('get-setting', (_, { key }) => {
    const row = queryOne('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : null;
  });

  ipcMain.handle('window-minimize', () => {
    mainWindow.minimize();
  });

  ipcMain.handle('window-close', () => {
    mainWindow.close();
  });

  ipcMain.handle('get-auto-launch', async () => {
    const row = queryOne("SELECT value FROM settings WHERE key = 'auto_start'");
    return row ? row.value === 'true' : false;
  });

  ipcMain.handle('set-auto-launch', async (_, enabled) => {
    const appName = '电锯人待办';
    const appPath = process.execPath;
    const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

    // Always persist to DB first (guaranteed source of truth)
    db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('auto_start', ?)",
      [enabled ? 'true' : 'false']
    );
    saveDB();

    // Sync to Windows registry via HKCU (no admin required)
    try {
      if (enabled) {
        const cmd = `reg add "${regKey}" /v "${appName}" /t REG_SZ /d "\\"${appPath}\\"" /f`;
        await new Promise((resolve) => {
          exec(cmd, (err) => {
            if (err) console.error('Auto-start registry add failed:', err.message);
            resolve();
          });
        });
      } else {
        const cmd = `reg delete "${regKey}" /v "${appName}" /f`;
        await new Promise((resolve) => {
          exec(cmd, (err) => {
            if (err && !err.message.includes('unable to find')) {
              console.error('Auto-start registry delete failed:', err.message);
            }
            resolve();
          });
        });
      }
    } catch (e) {
      console.error('Auto-start registry sync error:', e);
    }

    return true;
  });

  ipcMain.handle('set-setting', (_, { key, value }) => {
    db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    saveDB();
    return { success: true };
  });
}

// ─── Auto Launch ────────────────────────────────────

function getRegAutoStart() {
  const appName = '电锯人待办';
  const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
  return new Promise((resolve) => {
    exec(`reg query "${regKey}" /v "${appName}"`, (err) => {
      resolve(!err); // true if key exists, false otherwise
    });
  });
}

async function syncAutoLaunch() {
  try {
    const row = queryOne("SELECT value FROM settings WHERE key = 'auto_start'");
    const shouldEnable = row ? row.value === 'true' : false;
    const currentlyEnabled = await getRegAutoStart();

    if (shouldEnable && !currentlyEnabled) {
      const appPath = process.execPath;
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
      const cmd = `reg add "${regKey}" /v "电锯人待办" /t REG_SZ /d "\\"${appPath}\\"" /f`;
      exec(cmd, (err) => {
        if (err) console.error('Auto-start sync add failed:', err.message);
      });
    } else if (!shouldEnable && currentlyEnabled) {
      const regKey = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';
      const cmd = `reg delete "${regKey}" /v "电锯人待办" /f`;
      exec(cmd, (err) => {
        if (err && !err.message.includes('unable to find')) {
          console.error('Auto-start sync delete failed:', err.message);
        }
      });
    }
  } catch (e) {
    console.error('Auto-start sync error:', e);
  }
}

// ─── Reminder Timer ─────────────────────────────────
let reminderTimer = null;

function startReminderTimer() {
  reminderTimer = setInterval(() => {
    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const todos = queryAll(
      "SELECT * FROM todos WHERE status = 'active' AND remind_at = ?",
      [timeStr]
    );

    for (const todo of todos) {
      if (Notification.isSupported()) {
        new Notification({ title: '电锯人待办提醒', body: todo.title }).show();
      }
    }
  }, 30000);
}

// ─── App Lifecycle ──────────────────────────────────
app.whenReady().then(async () => {
  await initDB();
  setupIPC();
  createWindow();
  createTray();
  syncAutoLaunch();
  startReminderTimer();
});

app.on('window-all-closed', () => {
  // Don't quit; keep running in tray
});

app.on('before-quit', () => {
  isQuitting = true;
  if (reminderTimer) clearInterval(reminderTimer);
  if (db) {
    saveDB();
    db.close();
  }
});
