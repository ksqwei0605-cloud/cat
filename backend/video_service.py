"""Video understanding service using doubao-seed-2-0-lite-260215 model.

Falls back to mock mode when the external API is unreachable.
"""

import json
import os
import httpx
from typing import Optional

# API config
BASE_URL = "https://api.openai-next.com"
API_KEY = "sk-8TfEUFiXV0lrMUH22dDd4a6cB74c4f1fA82b2f57E5146fB3"
MODEL = "doubao-seed-2-0-lite-260215"

# When true, use mock data instead of calling the real API
USE_MOCK = os.environ.get("USE_MOCK", "true").lower() == "true"


def _build_system_prompt() -> str:
    return """你是一个视频理解专家。你需要分析用户收藏的美食类短视频内容，并提取关键信息。
请严格按照以下JSON格式返回分析结果：
{
  "category": "美食",
  "subcategory": "具体子类别，如家常菜/烘焙/甜品/饮品/小吃等",
  "dish_name": "视频中出现的菜品名称，如果明确的话",
  "key_ingredients": ["主要食材列表"],
  "difficulty": "简单/中等/困难",
  "estimated_time_minutes": 估计所需分钟数,
  "tags": ["相关标签"],
  "summary": "一句话概括这个视频内容"
}

只返回JSON，不要返回其他文字。"""


async def understand_video(title: str, description: str) -> dict:
    """Analyze a single video's content and return structured understanding."""
    if USE_MOCK:
        return _mock_understand(title, description)

    user_prompt = f"视频标题：{title}\n视频描述：{description}"

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                f"{BASE_URL}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [
                        {"role": "system", "content": _build_system_prompt()},
                        {"role": "user", "content": user_prompt},
                    ],
                    "temperature": 0.3,
                    "max_tokens": 500,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        print(f"[video_service] API call failed, falling back to mock: {e}")
        return _mock_understand(title, description)


def _mock_understand(title: str, description: str) -> dict:
    """Mock video understanding with realistic responses based on keywords."""
    title_lower = (title + " " + description).lower()

    if "牛肉" in title_lower or "牛腩" in title_lower:
        return {
            "category": "美食",
            "subcategory": "家常菜",
            "dish_name": "土豆炖牛腩",
            "key_ingredients": ["牛腩", "土豆", "胡萝卜", "洋葱", "番茄"],
            "difficulty": "中等",
            "estimated_time_minutes": 60,
            "tags": ["炖菜", "家常菜", "牛肉", "下饭菜"],
            "summary": "一道经典的家常炖菜，牛腩软烂入味，土豆绵密，汤汁浓郁。",
        }
    elif "炒" in title_lower or "家常" in title_lower:
        return {
            "category": "美食",
            "subcategory": "快手菜",
            "dish_name": "家常小炒",
            "key_ingredients": ["时令蔬菜", "肉片", "蒜", "姜", "酱油"],
            "difficulty": "简单",
            "estimated_time_minutes": 20,
            "tags": ["快手菜", "家常菜", "简单"],
            "summary": "一道简单快手的家常小炒，食材灵活，适合日常。",
        }
    elif "面" in title_lower or "粉" in title_lower:
        return {
            "category": "美食",
            "subcategory": "面食",
            "dish_name": "手工汤面",
            "key_ingredients": ["面条", "高汤", "蔬菜", "鸡蛋", "葱花"],
            "difficulty": "简单",
            "estimated_time_minutes": 25,
            "tags": ["面食", "快手", "暖胃"],
            "summary": "一碗温暖的汤面，简单又满足。",
        }
    elif "蛋糕" in title_lower or "甜品" in title_lower or "烘焙" in title_lower:
        return {
            "category": "美食",
            "subcategory": "烘焙甜品",
            "dish_name": "手工蛋糕",
            "key_ingredients": ["面粉", "鸡蛋", "糖", "黄油", "奶油"],
            "difficulty": "中等",
            "estimated_time_minutes": 45,
            "tags": ["烘焙", "甜品", "下午茶"],
            "summary": "一款香甜绵软的手工蛋糕，适合下午茶时光。",
        }
    else:
        return {
            "category": "美食",
            "subcategory": "美食推荐",
            "dish_name": title,
            "key_ingredients": [],
            "difficulty": "中等",
            "estimated_time_minutes": 30,
            "tags": ["美食", "推荐"],
            "summary": description or f"一段关于{title}的美食视频。",
        }


async def understand_multiple_videos(videos: list[dict]) -> list[dict]:
    """Analyze multiple videos and return enrichment data for each."""
    results = []
    for v in videos:
        result = await understand_video(v["title"], v.get("description", ""))
        results.append({**v, "understanding": result})
    return results
