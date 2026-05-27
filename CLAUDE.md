# CLAUDE.md — 电锯人待办事项

## 项目概述
电锯人（Chainsaw Man）主题的 Windows 桌面待办事项应用。
Tauri 2.x + Vanilla JS + SQLite。

## 标准文档路径

| 文档 | 路径 | 说明 |
|------|------|------|
| 需求规格 | `docs/01-requirements.md` | 完整功能需求清单 |
| 技术规范 | `docs/02-tech-stack.md` | 技术栈、编码规范、项目结构 |
| 设计规范 | `docs/03-design-specs.md` | 配色、字体、组件、动画参数 |
| 系统架构 | `docs/04-architecture.md` | 模块划分、数据模型、数据流 |
| 开发步骤 | `docs/05-dev-plan.md` | 分阶段执行计划与进度 |
| 玛奇玛台词 | `docs/06-makima-dialogues.md` | 0-10 分台词表 + 满分彩蛋 |

## 工作约定

1. **开始前**：读取 `docs/05-dev-plan.md` 确认当前阶段和进度
2. **结束后**：更新 `dev-logs/YYYY-MM-DD.md` 记录今日完成、问题和明日计划
3. **分阶段推进**：一个阶段完成并验证后再进入下一阶段，不要跳步
4. **需求变更**：先更新 `docs/01-requirements.md`，再改代码
5. **遵循设计规范**：编码前参考 `docs/03-design-specs.md` 的配色和参数

## 项目结构

```
chainsawman/
├── CLAUDE.md
├── docs/              # 6 个标准文档
├── dev-logs/          # 每日开发日志
├── assets/            # 图片、音效
├── src/               # 前端 HTML/CSS/JS
└── src-tauri/         # Rust 后端
```

## 常用命令

- `cargo tauri dev` — 启动开发模式
- `cargo tauri build` — 打包 .msi/.exe
- 先确保 Rust 和 Tauri CLI 已安装
