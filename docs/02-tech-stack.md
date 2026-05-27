# 技术规范 — 电锯人待办事项

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 桌面框架 | Electron 35.x | Node.js 后端 + Chromium Web 前端 |
| 前端 | Vanilla HTML/CSS/JS (ES6+) | 无框架，保持轻量 |
| 后端 | Node.js (Electron Main Process) | IPC 通信 |
| 数据库 | SQLite (better-sqlite3) | 同步操作，本地单文件存储 |
| 音效 | Web Audio API | 合成引擎音效 |
| 通知 | Electron Notification API | 系统通知 |
| 自启动 | electron-auto-launch | 开机自启 |
| 打包 | Electron Builder / Forge | .exe / .msi |

## 安全
- `contextIsolation: true` — 渲染进程隔离
- `nodeIntegration: false` — 禁止渲染进程直接访问 Node
- `preload.js` 通过 `contextBridge` 暴露安全 API

## 编码规范

### JavaScript
- ES6+ 语法
- 函数命名 camelCase
- 渲染进程通过 `window.chainsawAPI` 调用主进程方法
- DOM 操作用原生 API
- IPC 方法名用 kebab-case (main process handler)

### CSS
- BEM 命名：`.block__element--modifier`
- CSS 变量定义主题色
- Flexbox / Grid 布局
- 动画用 CSS transition + transform

## 项目结构
```
main.js                    # Electron 主进程 (IPC handlers, DB, tray, timer)
preload.js                 # contextBridge 安全桥接
src/
├── index.html             # 主窗口
├── main.js                # 渲染进程入口
└── styles/
    └── main.css           # 全局样式

assets/
├── images/                # 玛奇玛 Q 版图片
└── tray-icon.png          # 托盘图标 (16x16)
```
