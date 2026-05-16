"""饿猫 Backend - FastAPI application.

Endpoints:
- POST /api/ingest - Simulate ingesting saved videos
- GET /api/status  - Check threshold and system status
- GET /api/recommendations - Get food recommendations
- POST /api/war-room/start - Start multi-agent debate
- GET /api/war-room/{session_id}/stream - SSE stream of debate
"""

import json
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from . import database as db
from . import schemas
from . import seed_data
from . import video_service
from . import threshold_detector as threshold
from . import war_room


@asynccontextmanager
async def lifespan(app: FastAPI):
    db.init_db()
    yield


app = FastAPI(title="饿猫 API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/ingest")
async def ingest_videos():
    """Simulate receiving saved videos from Douyin favorites.

    Seeds 3 food videos, runs video understanding on each,
    stores results, and returns status.
    """
    # Clear existing data for fresh demo
    conn = db.get_conn()
    conn.execute("PRAGMA foreign_keys=OFF")
    conn.execute("DELETE FROM war_room_messages")
    conn.execute("DELETE FROM war_room_sessions")
    conn.execute("DELETE FROM videos")
    conn.execute("DELETE FROM config WHERE key IN ('food_threshold', 'triggered')")
    conn.execute("INSERT OR IGNORE INTO config (key, value) VALUES ('food_threshold', '3')")
    conn.execute("INSERT OR IGNORE INTO config (key, value) VALUES ('triggered', 'false')")
    conn.execute("PRAGMA foreign_keys=ON")
    conn.commit()
    conn.close()

    # Seed the 3 food videos
    video_ids = []
    for v in seed_data.SEED_VIDEOS:
        vid = db.add_video(v["title"], v["url"], v["description"])
        video_ids.append(vid)

    # Run video understanding on each
    for v, vid in zip(seed_data.SEED_VIDEOS, video_ids):
        result = await video_service.understand_video(v["title"], v["description"])
        db.update_video_understanding(vid, result.get("category", "美食"), result)

    # Check threshold
    status = threshold.check_threshold()
    if status["met"]:
        threshold.mark_triggered(True)

    return {
        "message": f"已接收 {len(video_ids)} 个收藏视频",
        "video_ids": video_ids,
        "status": status,
    }


@app.get("/api/status")
async def get_status():
    """Get current system status - video counts, threshold, etc."""
    videos = db.get_all_videos()
    category_counts = db.count_videos_by_category()
    food_count = category_counts.get("美食", 0)
    threshold_val = int(db.get_config("food_threshold", "3"))
    triggered = db.get_config("triggered", "false") == "true"

    return {
        "total_videos": len(videos),
        "category_counts": category_counts,
        "food_threshold": threshold_val,
        "food_count": food_count,
        "threshold_met": food_count >= threshold_val,
        "triggered": triggered,
        "videos": [
            {
                "id": v["id"],
                "title": v["title"],
                "category": v["category"],
                "dish_name": json.loads(v.get("understanding_result", "{}")).get("dish_name", ""),
                "summary": json.loads(v.get("understanding_result", "{}")).get("summary", ""),
            }
            for v in videos
        ],
    }


@app.get("/api/recommendations")
async def get_recommendations():
    """Get food recommendations based on analyzed videos."""
    rec = await threshold.generate_recommendations()
    food_videos = db.get_videos_by_category("美食")

    return {
        "recommendation": rec,
        "source_videos": [
            {
                "id": v["id"],
                "title": v["title"],
                "dish_name": json.loads(v.get("understanding_result", "{}")).get("dish_name", ""),
                "tags": json.loads(v.get("understanding_result", "{}")).get("tags", []),
            }
            for v in food_videos
        ],
    }


@app.post("/api/war-room/start")
async def start_war_room(req: schemas.WarRoomStartRequest):
    """Start a war-room debate session.

    The actual debate runs via SSE streaming on the /stream endpoint.
    This endpoint just validates and creates the session.
    """
    food_videos = db.get_videos_by_category("美食")
    if not food_videos:
        raise HTTPException(400, "没有已分析的美食视频，请先调用 /api/ingest")

    # Get the top recommendation as the topic
    topic = req.topic or "综合美食推荐"
    dish_name = "土豆牛腩"
    if food_videos:
        first = json.loads(food_videos[0].get("understanding_result", "{}"))
        dish_name = first.get("dish_name", "美食推荐")

    return {
        "message": "参谋室已准备好",
        "topic": topic,
        "dish_name": dish_name,
        "agent_count": len(war_room.AGENTS),
        "agents": [{"role": a["role"], "name": a["name"], "emoji": a["emoji"]} for a in war_room.AGENTS],
        "max_rounds": 2,
    }


@app.get("/api/war-room/{session_id}/stream")
async def stream_war_room(session_id: str):
    """SSE stream of the war room debate."""
    # Check if session already has messages
    existing = db.get_war_room_messages(session_id)
    if existing:
        # Session already exists, resume streaming (or just return existing)
        pass

    food_videos = db.get_videos_by_category("美食")
    if not food_videos:
        raise HTTPException(400, "没有已分析的美食视频")

    first = json.loads(food_videos[0].get("understanding_result", "{}"))
    dish_name = first.get("dish_name", "美食推荐")
    topic = f"综合推荐 - {dish_name}"

    video_context = json.dumps(
        [
            {"title": v["title"], "understanding": json.loads(v.get("understanding_result", "{}"))}
            for v in food_videos
        ],
        ensure_ascii=False,
    )

    async def event_generator():
        async for event in war_room.run_debate_stream(
            topic=topic,
            dish_name=dish_name,
            video_context=video_context,
            max_rounds=1,
        ):
            yield {"data": json.dumps(event, ensure_ascii=False)}
            if event.get("type") == "done":
                break

    return EventSourceResponse(event_generator())


@app.get("/api/war-room/{session_id}/messages")
async def get_war_room_messages(session_id: str):
    """Get all messages from a war room session."""
    msgs = db.get_war_room_messages(session_id)
    if not msgs:
        # Create a fresh session and run it
        food_videos = db.get_videos_by_category("美食")
        if not food_videos:
            raise HTTPException(400, "没有已分析的美食视频")

        first = json.loads(food_videos[0].get("understanding_result", "{}"))
        dish_name = first.get("dish_name", "美食推荐")

        # Run debate and collect messages
        collected = []
        async for event in war_room.run_debate_stream(
            topic=f"综合推荐 - {dish_name}",
            dish_name=dish_name,
            max_rounds=1,
        ):
            if event.get("type") == "message":
                collected.append(event)
            elif event.get("type") == "done":
                break

        return {"messages": collected, "session_id": session_id}

    return {"messages": [dict(m) for m in msgs], "session_id": session_id}


@app.post("/api/war-room/new")
async def new_war_room():
    """Create a new war room session and run the debate immediately.

    Returns all messages from the debate.
    """
    food_videos = db.get_videos_by_category("美食")
    if not food_videos:
        raise HTTPException(400, "没有已分析的美食视频，请先调用 /api/ingest")

    first = json.loads(food_videos[0].get("understanding_result", "{}"))
    dish_name = first.get("dish_name", "美食推荐")

    collected = []
    session_id_final = ""
    async for event in war_room.run_debate_stream(
        topic=f"综合推荐 - {dish_name}",
        dish_name=dish_name,
        max_rounds=2,
    ):
        if event.get("type") == "session_start":
            session_id_final = event.get("session_id", "")
        elif event.get("type") == "message":
            collected.append(event)
        elif event.get("type") == "done":
            break

    return {
        "session_id": session_id_final,
        "topic": f"综合推荐 - {dish_name}",
        "dish_name": dish_name,
        "messages": collected,
    }
