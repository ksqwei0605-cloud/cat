# 饿猫 Backend — 收藏夹智能参谋系统

## 启动

```bash
# 启动后端 (默认端口 8001)
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload

# 或一键启动前后端
bash start.sh
```

## API 端点

| Method | Path | 说明 |
|--------|------|------|
| `POST` | `/api/ingest` | 模拟接收 3 个收藏视频 → 视频理解 → 阈值检测 |
| `GET` | `/api/status` | 系统状态：视频统计、阈值触发状态 |
| `GET` | `/api/recommendations` | 基于视频理解结果生成美食推荐 |
| `POST` | `/api/war-room/new` | 启动参谋室辩论并返回所有消息 |
| `POST` | `/api/war-room/start` | 创建参谋室会话（不启动辩论） |
| `GET` | `/api/war-room/{id}/stream` | SSE 流式获取辩论过程 |
| `GET` | `/api/war-room/{id}/messages` | 获取会话历史消息 |
| `GET` | `/api/health` | 健康检查 |

## 完整流程

```
curl -X POST http://localhost:8001/api/ingest          # 1. 模拟收藏
curl http://localhost:8001/api/status                   # 2. 检查阈值
curl http://localhost:8001/api/recommendations          # 3. 获取推荐
curl -X POST http://localhost:8001/api/war-room/new     # 4. 参谋室辩论
```

## 技术栈

- **FastAPI** — REST API 框架
- **SQLite** — 嵌入式数据库
- **LangGraph** — 多智能体辩论编排
- **sse-starlette** — SSE 流式推送
- **httpx** — 外部 API 调用

## 外部 API 集成

此系统设计了完整的外部 API 集成代码（`video_service.py`、`threshold_detector.py`、`war_room.py`），但在当前环境下 API 不可达时会自动降级为 **Mock 模式**（通过 `USE_MOCK=true` 环境变量控制）。Mock 模式使用精心设计的模拟数据，演示完整的业务流程。

要切换到真实 API，请设置 `USE_MOCK=false`：

```bash
USE_MOCK=false python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001
```

## 数据库

数据库文件：`backend/hungry_cat.db`（自动创建）
表：
- `videos` — 视频元数据 + 理解结果
- `war_room_sessions` — 辩论会话
- `war_room_messages` — 辩论消息
- `config` — 系统配置（阈值等）
