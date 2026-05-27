# 系统架构 — 电锯人待办事项

## 架构概览
```
[Renderer Process] ←→ [contextBridge IPC] ←→ [Main Process] ←→ [SQLite]
   HTML/CSS/JS           chainsawAPI           main.js        better-sqlite3
```

## Electron 主进程 — IPC Handlers

```
// 待办 CRUD
add-todo({ title, todoType, remindAt })
get-todos({ year, weekNumber })
update-todo({ id, title?, todoType?, remindAt? })
delete-todo({ id })

// 完成 & 评分
complete-todo({ id, score })

// 本周总结
get-summary({ year, weekNumber })

// 日常/周常重置
check-recurring()

// 通知
show-notification({ title, body })

// 设置
get-setting({ key })
set-setting({ key, value })
```

## SQLite 数据模型

### todos 表
```sql
CREATE TABLE todos (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    title       TEXT NOT NULL,
    todo_type   TEXT NOT NULL DEFAULT 'normal',  -- 'daily' | 'weekly' | 'normal'
    remind_at   TEXT,                             -- 'HH:MM' 或 NULL
    status      TEXT NOT NULL DEFAULT 'active',   -- 'active' | 'completed'
    score       INTEGER,                          -- 0-10，完成时写入
    completed_at TEXT,                            -- ISO datetime
    created_at  TEXT NOT NULL DEFAULT (datetime('now','localtime')),
    week_year   INTEGER NOT NULL,                 -- 所属周的年份
    week_number INTEGER NOT NULL                  -- 所属周的周数
);
```

### settings 表
```sql
CREATE TABLE settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
-- 内置 key: 'muted' ('true'/'false'), 'auto_start' ('true'/'false')
```

## 前端模块

```
main.js (渲染进程入口)
  ├── 待办列表渲染    → renderTodos()
  ├── 拉绳交互        → attachPullCord()
  ├── 音频            → playEngineSound() (Web Audio API)
  ├── 评分弹窗        → renderScoringBoxes()
  ├── 总结视图        → renderSummary()
  ├── 上下文菜单      → showContextMenu()
  └── 提醒轮询        → setInterval (30秒)
```

## 关键数据流

### 完成待办流程
```
用户拖拽拉绳 → attachPullCord 检测 100px 阈值
  → 触发窗口震动 (CSS shake animation)
  → 松手 → 播放引擎音效 (Web Audio API)
  → triggerComplete(id) → 评分弹窗
  → 用户选择 0-10 分 → chainsawAPI.completeTodo({id, score})
  → Main Process: UPDATE todos SET status='completed', score=?
  → 刷新列表 + 血迹删除线 SVG 渲染
```

### 日常/周常重置
```
应用启动时 / setInterval 定时器
  → chainsawAPI.checkRecurring()
  → Main Process: 重置 daily (当天之前) / weekly (之前周) 的已完成项
  → 返回最新周数据 → 刷新列表
```

### 提醒通知
```
30秒轮询 → 匹配当前 HH:MM 与 todos.remind_at
  → chainsawAPI.showNotification({ title, body })
  → Main Process: new Notification() 系统弹窗
```

### 窗口与托盘
```
关闭按钮 → event.preventDefault() + mainWindow.hide() (最小化到托盘)
托盘双击 → mainWindow.show() + focus()
托盘右键 → 菜单: 显示窗口 / 退出
退出 → isQuitting = true → app.quit() → 清理定时器 + 关闭数据库
```
