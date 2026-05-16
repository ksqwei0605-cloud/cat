"""Pydantic schemas for API request/response."""

from pydantic import BaseModel
from typing import Optional


class VideoIngestRequest(BaseModel):
    """Simulate receiving a saved video."""
    title: str
    url: str = ""
    description: str = ""


class VideoResponse(BaseModel):
    id: int
    title: str
    url: str
    description: str
    category: str
    understanding_result: dict
    created_at: str


class StatusResponse(BaseModel):
    total_videos: int
    category_counts: dict
    food_threshold: int
    food_count: int
    threshold_met: bool
    triggered: bool


class RecommendationResponse(BaseModel):
    title: str
    description: str
    ingredients: list[str]
    steps: list[str]
    tips: str
    source_videos: list[VideoResponse]


class WarRoomStartRequest(BaseModel):
    topic: str = ""
    video_ids: list[int] = []


class WarRoomStartResponse(BaseModel):
    session_id: str
    topic: str
    status: str


class WarRoomMessage(BaseModel):
    id: int
    session_id: str
    agent_role: str
    agent_name: str
    content: str
    created_at: str
