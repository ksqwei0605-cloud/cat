# 饿猫 · 收藏夹智能参谋系统

## 项目概述

用户抖音收藏夹的美食视频达到阈值时，自动弹出「饿猫」前端页面，推荐美食并启动 AI 多参谋辩论。

## 目录结构

```
/root/cat/
├── backend/                     # Python FastAPI 后端
│   ├── main.py                  # FastAPI 应用入口
│   ├── database.py              # SQLite 数据库层
│   ├── schemas.py               # Pydantic 模型
│   ├── video_service.py         # 视频理解服务（doubao）
│   ├── threshold_detector.py    # 阈值检测 + 推荐引擎
│   ├── war_room.py              # LangGraph 多智能体辩论
│   ├── seed_data.py             # 3 个模拟美食视频
│   ├── ARCHITECTURE.md          # 架构文档
│   └── README.md                # 使用说明
├── src/
│   ├── components/cat-app/
│   │   └── HungryCatApp.tsx      # 主前端组件（已接入 API）
│   └── lib/
│       └── frontend-api.ts      # API 服务层（TypeScript）
├── start.sh                     # 一键启动脚本
└── CLAUDE.md                    # 本文件
```

## 启动方式

```bash
# 后端
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001

# 前端（需要 bun）
bun run dev
```

## API 端点 (后端端口 8001)

- POST /api/ingest — 模拟收藏 + 视频理解
- GET /api/status — 系统状态
- GET /api/recommendations — 美食推荐
- POST /api/war-room/new — 启动参谋室辩论
- GET /api/war-room/{id}/stream — SSE 流

## 核心设计

- 视频理解：doubao-seed-2-0-lite-260215（当前 mock 模式）
- 多智能体：LangGraph + gpt-5.5（4 角色：厨子/配料师/营养/省钱）
- 阈值检测：美食类视频 >= 3 触发
- 前端集成：React + TanStack + SSE streaming
