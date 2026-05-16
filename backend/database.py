"""SQLite database layer using built-in sqlite3 module."""

import sqlite3
import json
import os
import time
from datetime import datetime
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "hungry_cat.db")

_MAX_RETRIES = 5


def _with_retry(fn, *args, **kwargs):
    """Execute a database operation with retry on locked."""
    for attempt in range(_MAX_RETRIES):
        try:
            return fn(*args, **kwargs)
        except sqlite3.OperationalError as e:
            if "locked" in str(e) and attempt < _MAX_RETRIES - 1:
                time.sleep(0.2 * (attempt + 1))
                continue
            raise


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_conn()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS videos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            url TEXT DEFAULT '',
            description TEXT DEFAULT '',
            category TEXT DEFAULT '',
            understanding_result TEXT DEFAULT '{}',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS war_room_sessions (
            id TEXT PRIMARY KEY,
            topic TEXT NOT NULL,
            video_ids TEXT DEFAULT '[]',
            status TEXT DEFAULT 'pending',
            summary TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS war_room_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id TEXT REFERENCES war_room_sessions(id),
            agent_role TEXT NOT NULL,
            agent_name TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        INSERT OR IGNORE INTO config (key, value) VALUES ('food_threshold', '3');
        INSERT OR IGNORE INTO config (key, value) VALUES ('triggered', 'false');
    """)
    conn.commit()
    conn.close()


# ---- Video operations ----

def add_video(title: str, url: str, description: str) -> int:
    conn = get_conn()
    cur = conn.execute(
        "INSERT INTO videos (title, url, description) VALUES (?, ?, ?)",
        (title, url, description),
    )
    conn.commit()
    vid = cur.lastrowid
    conn.close()
    return vid


def update_video_understanding(video_id: int, category: str, understanding: dict):
    conn = get_conn()
    conn.execute(
        "UPDATE videos SET category=?, understanding_result=? WHERE id=?",
        (category, json.dumps(understanding, ensure_ascii=False), video_id),
    )
    conn.commit()
    conn.close()


def get_all_videos():
    conn = get_conn()
    rows = conn.execute("SELECT * FROM videos ORDER BY id").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_videos_by_category(category: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM videos WHERE category=? ORDER BY id", (category,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def count_videos_by_category():
    conn = get_conn()
    rows = conn.execute(
        "SELECT category, COUNT(*) as cnt FROM videos GROUP BY category"
    ).fetchall()
    conn.close()
    return {r["category"]: r["cnt"] for r in rows}


# ---- Config operations ----

def get_config(key: str, default: str = "") -> str:
    conn = get_conn()
    row = conn.execute("SELECT value FROM config WHERE key=?", (key,)).fetchone()
    conn.close()
    return row["value"] if row else default


def set_config(key: str, value: str):
    conn = get_conn()
    conn.execute(
        "INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", (key, value)
    )
    conn.commit()
    conn.close()


# ---- War Room operations ----

def create_war_room_session(session_id: str, topic: str, video_ids: list[int]):
    conn = get_conn()
    conn.execute(
        "INSERT INTO war_room_sessions (id, topic, video_ids) VALUES (?, ?, ?)",
        (session_id, topic, json.dumps(video_ids)),
    )
    conn.commit()
    conn.close()


def add_war_room_message(session_id: str, agent_role: str, agent_name: str, content: str):
    conn = get_conn()
    conn.execute(
        "INSERT INTO war_room_messages (session_id, agent_role, agent_name, content) VALUES (?, ?, ?, ?)",
        (session_id, agent_role, agent_name, content),
    )
    conn.commit()
    conn.close()


def get_war_room_messages(session_id: str):
    conn = get_conn()
    rows = conn.execute(
        "SELECT * FROM war_room_messages WHERE session_id=? ORDER BY id",
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def update_war_room_status(session_id: str, status: str, summary: str = ""):
    conn = get_conn()
    if summary:
        conn.execute(
            "UPDATE war_room_sessions SET status=?, summary=? WHERE id=?",
            (status, summary, session_id),
        )
    else:
        conn.execute(
            "UPDATE war_room_sessions SET status=? WHERE id=?",
            (status, session_id),
        )
    conn.commit()
    conn.close()


def get_war_room_session(session_id: str):
    conn = get_conn()
    row = conn.execute(
        "SELECT * FROM war_room_sessions WHERE id=?", (session_id,)
    ).fetchone()
    conn.close()
    return dict(row) if row else None
