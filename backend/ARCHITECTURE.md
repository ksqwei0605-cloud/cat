# 饿猫 · 收藏夹智能参谋系统架构

## 整体架构

```
┌─────────────────┐     ┌─────────────────────────────────────┐     ┌──────────────┐
│  前端 (React)    │     │          FastAPI 后端                 │     │   外部 API    │
│                 │────▶│                                     │────▶│              │
│  HungryCatApp   │     │  video_service ▶ threshold_detector  │     │  doubao-seed │
│  + SSE Stream   │◀────│  war_room (LangGraph)                │◀────│  gpt-5.5     │
│                 │     │  SQLite DB                           │     │              │
└─────────────────┘     └─────────────────────────────────────┘     └──────────────┘
```

## 数据流

```
用户收藏视频 (模拟3个美食视频)
        │
        ▼
  Video Understanding (doubao-seed-2-0-lite-260215)
        │  - 分析视频内容、分类、提取关键信息
        │  - 判断是否为美食类别
        ▼
  SQLite 存储分析结果
        │
        ▼
  Threshold Detector
        │  - 统计美食类视频数量/频率
        │  - 超过阈值 → 触发前端弹出
        ▼
  前端「饿猫」页面展示
        │  - 根据分析结果生成推荐
        │  - 用户可进入参谋室
        ▼
  War Room (LangGraph Multi-Agent)
        │  - 主厨、配料师、营养顾问、省钱顾问
        │  - 多轮辩论 → 流式输出到前端
        ▼
  最终推荐总结（食材清单 + 做法）
```

## 后端 API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/ingest | 模拟接收收藏视频，运行视频理解 |
| GET | /api/status | 检查系统状态、分类统计、阈值触发 |
| GET | /api/recommendations | 获取 AI 生成的美食推荐 |
| POST | /api/war-room/start | 启动 LangGraph 多参谋辩论 |
| GET | /api/war-room/{id}/stream | SSE 流式获取辩论过程 |

## LangGraph 多参谋辩论架构

```
              ┌──────────────┐
              │  Coordinator  │ (讨论主持人)
              └──────┬───────┘
                     │
          ┌──────────┼──────────┐
          ▼          ▼          ▼
   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐
   │  主厨     │ │  配料师   │ │ 营养顾问  │ │  省钱顾问     │
   │ (Chef)    │ │(Ingredient│ │(Nutrition)│ │ (Budget)     │
   └──────────┘ └──────────┘ └──────────┘ └──────────────┘
          │          │          │            │
          └──────────┼──────────┼────────────┘
                     ▼
              ┌──────────────┐
              │   Debate     │ (多轮辩论)
              │   Synthesis  │ (最终合成)
              └──────────────┘
```

## 数据库表

- **videos**: 收藏视频元数据 + 理解结果
- **war_room_sessions**: 辩论会话
- **war_room_messages**: 辩论消息流

## 外部 API

- Base URL: `https://api.openai-next.com`
- Model(doubao): `doubao-seed-2-0-lite-260215` (视频理解)
- Model(gpt-5.5): `gpt-5.5` (多智能体讨论 + 流式输出)
