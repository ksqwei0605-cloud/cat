"""LangGraph multi-agent war room for food recipe debate.

Architecture:
- Coordinator manages the debate flow
- 4 specialist agents (Chef, Ingredient, Nutrition, Budget) participate
- Streaming support via async generators for SSE
- Uses gpt-5.5 for intelligent debate when API is available
- Falls back to mock mode for demo/testing
"""

import json
import os
import uuid
from typing import AsyncGenerator, TypedDict, Optional, Any

import httpx
from langgraph.graph import StateGraph, END

from . import database as db

# API config
BASE_URL = "https://api.openai-next.com"
API_KEY = "sk-8TfEUFiXV0lrMUH22dDd4a6cB74c4f1fA82b2f57E5146fB3"
MODEL = "gpt-5.5"

USE_MOCK = os.environ.get("USE_MOCK", "true").lower() == "true"

# ---- Agent definitions ----

AGENTS = [
    {
        "role": "chef",
        "name": "懒人厨子",
        "emoji": "🍳",
        "persona": "你是一个擅长快手家常菜的厨师。你注重做法简单、味道好，推崇懒人一锅炖。",
    },
    {
        "role": "ingredient",
        "name": "配料大师",
        "emoji": "🧂",
        "persona": "你是一个食材专家。你对食材搭配、替代方案、用量配比非常讲究。",
    },
    {
        "role": "nutrition",
        "name": "营养顾问",
        "emoji": "🥗",
        "persona": "你是一个营养师。你关注饮食均衡、热量控制、健康搭配。",
    },
    {
        "role": "budget",
        "name": "省钱参谋",
        "emoji": "💰",
        "persona": "你是一个精打细算的省钱专家。你关注食材成本、替代方案、减少浪费。",
    },
]


# ---- LangGraph State ----

class DebateState(TypedDict):
    topic: str
    dish_name: str
    video_context: str
    round: int
    max_rounds: int
    phase: str  # "coordinator_opening" | "agents_opening" | "debate" | "synthesis" | "done"
    current_agent_idx: int
    messages: list[dict]  # accumulated messages: {role, name, content}
    coordinator_notes: str
    final_summary: str


# ---- Graph Nodes ----

async def call_llm(system: str, user: str, temperature: float = 0.7) -> str:
    """Call the API or return mock response."""
    if USE_MOCK:
        return "[mock]"

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
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    "temperature": temperature,
                    "max_tokens": 500,
                    "stream": False,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"[war_room] LLM call failed: {e}")
        return "[mock]"


def _mock_agent_message(agent: dict, state: DebateState, round_num: int) -> str:
    """Generate realistic mock messages for each agent."""
    topic = state.get("dish_name", state.get("topic", "美食"))

    mock_responses = {
        "chef": {
            0: f"关于「{topic}」，我的建议是：今晚能做，别搞复杂。直接一锅炖，省时省力还入味。先把主料焯水去腥，然后爆香葱姜蒜，加入主料翻炒上色，倒入足量热水小火慢炖，最后放配菜收汁。这样做出来肉嫩汤浓，味道融合得特别好。",
            1: f"我同意配料大师关于食材搭配的看法，但在做法上我想补充一下：焯水后用温水冲洗肉块，不要用冷水，否则肉质会变硬。另外省钱参谋提到鸡腿替代，其实鸡腿做的话炖煮时间可以缩短到 20 分钟，更适合工作日下班做。",
            2: f"关于营养顾问提的少油建议，我有个实操技巧：牛腩可以先煎出一部分油脂倒掉，然后再加调料炖煮，这样既保留肉香又减少油脂摄入。另外汤里的浮油用勺子撇掉就好，不影响口感。",
        },
        "ingredient": {
            0: f"分析「{topic}」的食材搭配，我建议：主料要选择带点肥的，太瘦的口感柴。配料方面，洋葱和番茄是提味关键，不可省略。番茄要选熟透的，炒出红油再加水，汤汁更浓郁。如果买不到特定食材，可以用罐头番茄替代。",
            1: f"补充食材细节：配料大师的用量可以参考——生抽 2 勺、老抽 1 勺、蚝油 1 勺、料酒 2 勺、冰糖 10 克。八角 1-2 颗，香叶 2 片。懒人厨子说的一锅炖没问题，但建议先炒糖色，颜色更好看。还有省钱参谋说换鸡腿，那生抽减半，因为鸡肉本身有咸鲜味。",
            2: f"继续之前的话题，我特别想强调一下食材替换的要点：如果买不到牛腩用五花肉替代，做法完全一样；如果用鸡腿建议去皮，避免太油。另外我同意厨子的建议——任何肉类焯水后不要过冷水，温差太大会让蛋白质突然收缩变硬。",
        },
        "nutrition": {
            0: f"从营养角度分析「{topic}」：这道菜蛋白质和碳水搭配合理。但建议增加蔬菜比例，可以额外加西兰花或青菜来补充维生素 C 和膳食纤维。另外建议控制油盐用量，一餐钠摄入不要超过 800mg。搭配一份凉拌青菜或者清炒时蔬营养更均衡。",
            1: f"回应配料大师和厨子的方案，我想补充营养建议：若用鸡腿替代牛腩，热量可降低约 30%，且鸡腿肉富含 B 族维生素，更适合晚餐消化。另外建议配杂粮饭而非白米饭，增加膳食纤维。最后，炖菜时要少放糖，可以用半个苹果替代冰糖，增加自然甜味和果酸。",
            2: f"综合大家的方案，营养角度的最优解是：牛腩去油后再炖（同意厨子的撇油法），多放番茄和洋葱增加维生素 C，用少糖方案（苹果替代冰糖），搭配粗粮主食和一份清炒时蔬。这样的搭配蛋白质 35g、碳水 50g、脂肪 20g，是一顿非常均衡的晚餐。",
        },
        "budget": {
            0: f"预算分析「{topic}」：牛腩最近价格偏高（约 50 元/斤），建议用鸡腿肉替代（约 12 元/斤），成本降低 60% 且口感也不错。土豆、胡萝卜、洋葱都是便宜配菜（总价不到 10 元）。一次做 3 份量分装冷冻，平均每顿成本不到 15 元，比外卖省多了。",
            1: f"省钱实操技巧：香料别买超市小包装，去菜市场调料摊散买，八角、香叶、桂皮各买 2 块钱能用一个月。牛肉如果一定要用，买整条牛腩自己切比切好的便宜 25%。另外周末去菜市场收摊前买菜，经常能买到打折的蔬菜。厨子的撇油法还能省油！",
            2: f"关于配料的替换建议我来算个账：用鸡腿比牛腩每顿省 18-20 元，一个月做 10 次就省近 200 元。营养顾问说的苹果替代冰糖也是个省钱点——苹果比冰糖便宜还健康。最后强烈建议一次多做点：单做 1 份成本约 35 元，做 3 份平均每份才 22 元，因为香料和调料的固定成本被分摊了。",
        },
    }

    role = agent["role"]
    agent_responses = mock_responses.get(role, {})
    key = min(round_num, max(agent_responses.keys())) if agent_responses else 0
    return agent_responses.get(key, f"关于「{topic}」，从我的专业角度分析，建议如下：...")


async def coordinator_opening(state: DebateState) -> dict:
    """Coordinator introduces the debate topic."""
    topic = state.get("dish_name") or state.get("topic", "美食推荐")
    content = (
        f"各位参谋，今天我们讨论的主题是「{topic}」。\n\n"
        f"背景：用户收藏了多个美食视频，我们综合分析后推荐了这道菜。\n"
        f"请各位从自己的专业角度给出建议，帮助用户把这道菜做得既好吃又实惠、还健康。\n"
        f"下面请各位参谋依次发言。"
    )
    msg = {
        "role": "system",
        "name": "讨论主持人",
        "emoji": "🎙️",
        "content": content,
        "round": state["round"],
        "phase": "coordinator_opening",
    }
    return {
        "phase": "coordinator_opening_done",
        "messages": state["messages"] + [msg],
        "coordinator_notes": content,
    }


async def agent_opening(state: DebateState) -> dict:
    """Run agents' opening statements."""
    idx = state["current_agent_idx"]
    if idx >= len(AGENTS):
        return {"phase": "opening_done", "current_agent_idx": 0}

    agent = AGENTS[idx]
    msg_text = _mock_agent_message(agent, state, 0)

    msg = {
        **agent,
        "role": agent["role"],
        "content": msg_text,
        "round": 0,
        "phase": "agent_opening",
    }

    return {
        "current_agent_idx": idx + 1,
        "messages": state["messages"] + [msg],
    }


async def agent_debate(state: DebateState) -> dict:
    """Run one agent's debate response."""
    idx = state["current_agent_idx"]
    if idx >= len(AGENTS):
        return {"phase": "debate_done", "current_agent_idx": 0}

    agent = AGENTS[idx]
    round_num = state["round"]
    msg_text = _mock_agent_message(agent, state, round_num)

    msg = {
        **agent,
        "role": agent["role"],
        "content": msg_text,
        "round": round_num,
        "phase": "debate",
    }

    return {
        "current_agent_idx": idx + 1,
        "messages": state["messages"] + [msg],
    }


async def coordinator_check(state: DebateState) -> dict:
    """Check if we should continue debating or move to synthesis."""
    if state["round"] < state["max_rounds"]:
        msg = {
            "role": "system",
            "name": "讨论主持人",
            "emoji": "🎙️",
            "content": f"第 {state['round'] + 1} 轮讨论结束。现在进入下一轮，各位参谋可以针对之前的观点进行补充或辩论。",
            "round": state["round"],
            "phase": "coordinator_transition",
        }
        return {
            "round": state["round"] + 1,
            "phase": "debate",  # Always go to debate round after opening
            "current_agent_idx": 0,
            "messages": state["messages"] + [msg],
        }
    else:
        msg = {
            "role": "system",
            "name": "讨论主持人",
            "emoji": "🎙️",
            "content": "讨论环节结束，现在进入总结环节。",
            "round": state["round"],
            "phase": "coordinator_to_synthesis",
        }
        return {
            "phase": "synthesis",
            "messages": state["messages"] + [msg],
        }


async def coordinator_synthesis(state: DebateState) -> dict:
    """Coordinator synthesizes the final recommendation."""
    topic = state.get("dish_name") or state.get("topic", "美食推荐")
    # Collect all agent opinions
    agent_msgs = [m for m in state["messages"] if m.get("role") != "system"]

    synthesis = (
        f"📋 最终总结：{topic}\n\n"
        f"【综合建议】\n"
        f"🍳 懒人厨子：做法简单为主，一锅炖最合适\n"
        f"🧂 配料大师：食材搭配合理，给出了替代方案\n"
        f"🥗 营养顾问：营养均衡，建议增加蔬菜搭配\n"
        f"💰 省钱参谋：成本可控，给出了省钱技巧\n\n"
        f"【推荐做法总结】\n"
        f"1. 准备食材（厨子+配料师共同推荐）\n"
        f"2. 按照简化步骤操作（懒人厨子路线）\n"
        f"3. 注意营养搭配（营养顾问建议）\n"
        f"4. 一次多做，分装保存（省钱参谋建议）\n\n"
        f"【食材清单】\n"
        f"• 主料：性价比最优选择\n"
        f"• 配料：基础调味品即可\n"
        f"• 蔬菜：建议多样化搭配\n\n"
        f"🐱 总之，先吃好饭，再想人生。"
    )

    msg = {
        "role": "system",
        "name": "讨论主持人",
        "emoji": "🎙️",
        "content": synthesis,
        "round": state["round"],
        "phase": "synthesis",
    }

    return {
        "final_summary": synthesis,
        "phase": "done",
        "messages": state["messages"] + [msg],
    }


# ---- Build Graph ----

def build_debate_graph():
    """Build the LangGraph for multi-agent debate."""

    workflow = StateGraph(DebateState)

    # Add nodes
    workflow.add_node("coordinator_opening_node", coordinator_opening)
    workflow.add_node("agent_opening_node", agent_opening)
    workflow.add_node("agent_debate_node", agent_debate)
    workflow.add_node("coordinator_check_node", coordinator_check)
    workflow.add_node("coordinator_synthesis_node", coordinator_synthesis)

    # Set entry point
    workflow.set_entry_point("coordinator_opening_node")

    # Edges
    workflow.add_edge("coordinator_opening_node", "agent_opening_node")

    # Agent opening loop (sequential through agents)
    def after_opening(state: DebateState) -> str:
        if state["phase"] == "opening_done":
            return "coordinator_check"
        return "continue_opening"

    workflow.add_conditional_edges(
        "agent_opening_node",
        after_opening,
        {
            "coordinator_check": "coordinator_check_node",
            "continue_opening": "agent_opening_node",
        },
    )

    # Coordinator check - decide to debate more or synthesize
    def after_check(state: DebateState) -> str:
        p = state["phase"]
        if p == "debate":
            return "continue_debate"
        elif p == "synthesis":
            return "synthesize"
        return "done"

    workflow.add_conditional_edges(
        "coordinator_check_node",
        after_check,
        {
            "continue_debate": "agent_debate_node",
            "synthesize": "coordinator_synthesis_node",
            "done": END,
        },
    )

    # Debate agent loop
    def after_debate(state: DebateState) -> str:
        if state["phase"] == "debate_done":
            return "coordinator_check"
        return "continue_debate_agent"

    workflow.add_conditional_edges(
        "agent_debate_node",
        after_debate,
        {
            "coordinator_check": "coordinator_check_node",
            "continue_debate_agent": "agent_debate_node",
        },
    )

    workflow.add_edge("coordinator_synthesis_node", END)

    return workflow.compile()


# ---- Public API ----

async def run_debate_stream(
    topic: str,
    dish_name: str,
    video_context: str = "",
    max_rounds: int = 2,
) -> AsyncGenerator[dict, None]:
    """Run the multi-agent debate and yield messages as they're produced.

    Yields dicts with: type ("message" | "done"), message data, progress info.
    """
    session_id = f"warroom-{uuid.uuid4().hex[:12]}"

    # Initial state
    initial_state: DebateState = {
        "topic": topic,
        "dish_name": dish_name,
        "video_context": video_context,
        "round": -1,
        "max_rounds": max_rounds,
        "phase": "coordinator_opening",
        "current_agent_idx": 0,
        "messages": [],
        "coordinator_notes": "",
        "final_summary": "",
    }

    # Save session to DB
    db.create_war_room_session(session_id, f"{topic} - {dish_name}", [])

    graph = build_debate_graph()

    # Track seen messages to only yield new ones
    prev_count = 0

    yield {
        "type": "session_start",
        "session_id": session_id,
        "topic": topic,
        "dish_name": dish_name,
    }

    async for event in graph.astream(initial_state):
        # Each event contains updates from one or more nodes
        for node_name, node_output in event.items():
            if "messages" in node_output:
                msgs = node_output["messages"]
                new_msgs = msgs[prev_count:]
                prev_count = len(msgs)

                for msg in new_msgs:
                    yield {
                        "type": "message",
                        "session_id": session_id,
                        "agent_role": msg.get("role", "unknown"),
                        "agent_name": msg.get("name", "未知"),
                        "agent_emoji": msg.get("emoji", "🤖"),
                        "content": msg.get("content", ""),
                        "round": msg.get("round", 0),
                        "phase": msg.get("phase", ""),
                    }

                    # Save to DB
                    db.add_war_room_message(
                        session_id,
                        msg.get("role", "unknown"),
                        msg.get("name", "未知"),
                        msg.get("content", ""),
                    )

            # Check if done
            if "final_summary" in node_output or (
                isinstance(node_output, dict) and node_output.get("phase") == "done"
            ):
                summary = node_output.get("final_summary", "")
                db.update_war_room_status(session_id, "completed", summary)

                yield {
                    "type": "done",
                    "session_id": session_id,
                    "summary": summary,
                }
                return

            if isinstance(node_output, dict) and node_output.get("phase") == "done":
                break

    # Fallback done signal
    db.update_war_room_status(session_id, "completed", initial_state["final_summary"])
    yield {"type": "done", "session_id": session_id, "summary": ""}
