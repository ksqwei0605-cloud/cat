"""Threshold detector and recommendation engine.

Tracks the number of food-category videos, checks against threshold,
and generates recommendations using the AI model.
"""

import json
import os
from typing import Optional
import httpx

from . import database as db

# API config
BASE_URL = "https://api.openai-next.com"
API_KEY = "sk-8TfEUFiXV0lrMUH22dDd4a6cB74c4f1fA82b2f57E5146fB3"
MODEL = "gpt-5.5"

USE_MOCK = os.environ.get("USE_MOCK", "true").lower() == "true"


def check_threshold() -> dict:
    """Check if food videos exceed the threshold.

    Returns:
        dict with: met (bool), food_count (int), threshold (int), category_counts (dict)
    """
    category_counts = db.count_videos_by_category()
    food_count = category_counts.get("美食", 0)
    threshold = int(db.get_config("food_threshold", "3"))

    return {
        "met": food_count >= threshold,
        "food_count": food_count,
        "threshold": threshold,
        "category_counts": category_counts,
        "total_videos": sum(category_counts.values()),
    }


async def generate_recommendations() -> dict:
    """Generate food recommendations based on analyzed videos.

    Uses the doubao-style responses stored in DB to synthesize a recommendation.
    """
    food_videos = db.get_videos_by_category("美食")

    if not food_videos:
        return _default_recommendation()

    if USE_MOCK:
        return _mock_recommendation(food_videos)

    # Build context from understood videos
    video_context = []
    for v in food_videos:
        understanding = json.loads(v["understanding_result"]) if v.get("understanding_result") else {}
        video_context.append({
            "title": v["title"],
            "dish": understanding.get("dish_name", ""),
            "ingredients": understanding.get("key_ingredients", []),
            "difficulty": understanding.get("difficulty", ""),
            "time": understanding.get("estimated_time_minutes", 30),
            "summary": understanding.get("summary", ""),
        })

    prompt = f"""基于用户收藏的以下美食视频，生成一个综合美食推荐方案：
{json.dumps(video_context, ensure_ascii=False, indent=2)}

请以JSON格式返回：
{{
  "title": "推荐菜名",
  "description": "推荐理由",
  "ingredients": ["食材清单"],
  "steps": ["步骤1", "步骤2", ...],
  "tips": "小贴士"
}}
只返回JSON。"""

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
                        {"role": "system", "content": "你是一个美食推荐专家。"},
                        {"role": "user", "content": prompt},
                    ],
                    "temperature": 0.5,
                    "max_tokens": 800,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return json.loads(content)
    except Exception as e:
        print(f"[threshold] API call failed, using mock: {e}")
        return _mock_recommendation(food_videos)


def _mock_recommendation(food_videos: list[dict]) -> dict:
    """Generate mock recommendation from analyzed videos."""
    dishes = []
    all_ingredients = set()

    for v in food_videos:
        u = json.loads(v.get("understanding_result", "{}"))
        dish = u.get("dish_name", v["title"])
        dishes.append(dish)
        for ing in u.get("key_ingredients", []):
            all_ingredients.add(ing)

    if not dishes:
        return _default_recommendation()

    main_dish = dishes[0] if dishes else "美食"

    return {
        "title": f"综合推荐：{main_dish}",
        "description": f"根据你收藏的 {len(food_videos)} 个美食视频综合分析，为你推荐这道菜。",
        "ingredients": sorted(all_ingredients) if all_ingredients else ["食材根据视频内容调整"],
        "steps": [
            f"参考你收藏的{dishes[0] if dishes else '相关'}视频，准备食材",
            "按照视频中的步骤进行处理",
            "根据个人口味调整调味",
            "装盘享用",
        ],
        "tips": "收藏的视频建议反复观看步骤细节，第一次做可以适当减少调料用量。",
        "source_videos": [
            {"title": v["title"], "dish": json.loads(v.get("understanding_result", "{}")).get("dish_name", "")}
            for v in food_videos
        ],
    }


def _default_recommendation() -> dict:
    return {
        "title": "土豆牛腩计划",
        "description": "经典家常菜，软烂入味的牛腩搭配绵密土豆。",
        "ingredients": ["牛腩 500g", "土豆 2个", "胡萝卜 1根", "洋葱 1个", "番茄 2个", "姜蒜", "生抽", "老抽", "料酒", "冰糖"],
        "steps": [
            "牛腩切块，冷水下锅焯水去血沫",
            "热锅冷油，爆香姜蒜，加入牛腩翻炒至表面微黄",
            "加入番茄块炒出汁，加生抽老抽料酒冰糖调味",
            "加入足量热水，大火烧开后转小火炖 40 分钟",
            "加入土豆和胡萝卜块，继续炖 20 分钟至软烂",
            "大火收汁，根据口味加盐调味，撒葱花出锅",
        ],
        "tips": "牛腩炖煮时间越长越软烂，建议使用高压锅可缩短至 25 分钟。一次多做些，第二天更入味。",
    }


def set_threshold(value: int):
    db.set_config("food_threshold", str(value))


def mark_triggered(val: bool):
    db.set_config("triggered", "true" if val else "false")


def is_triggered() -> bool:
    return db.get_config("triggered", "false") == "true"
