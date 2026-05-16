import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import catImg from "@/assets/hungry-cat.png";
import * as api from "@/lib/frontend-api";

type Page = "hook" | "analysis" | "tasks" | "action";

/* ---------- Main App ---------- */
export function HungryCatApp() {
  const [page, setPage] = useState<Page>("hook");
  const [loading, setLoading] = useState<string | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  // Backend state
  const [status, setStatus] = useState<api.StatusResponse | null>(null);
  const [recommendation, setRecommendation] = useState<api.Recommendation | null>(null);
  const [sourceVideos, setSourceVideos] = useState<api.RecommendationsResponse["source_videos"]>([]);
  const [warRoomMessages, setWarRoomMessages] = useState<api.WarRoomMessage[]>([]);
  const [warRoomLoading, setWarRoomLoading] = useState(false);
  const [warRoomSessionId, setWarRoomSessionId] = useState("");
  const [backendError, setBackendError] = useState<string | null>(null);

  const go = (next: Page, msg: string) => {
    setLoading(msg);
    setTimeout(() => {
      setPage(next);
      setLoading(null);
      window.scrollTo({ top: 0 });
    }, 800);
  };

  // Step 1: Ingest & analyze
  useEffect(() => {
    (async () => {
      try {
        const ingestResult = await api.ingestVideos();
        setStatus(ingestResult.status);
        const recs = await api.fetchRecommendations();
        setRecommendation(recs.recommendation);
        setSourceVideos(recs.source_videos);
      } catch (e: any) {
        console.error("Backend init error:", e);
        setBackendError(e.message || "无法连接后端");
      }
    })();
  }, []);

  // Step 2: Start war room when entering action page
  const handleEnterAction = async () => {
    go("action", "正在召唤参谋聊天室…");
    setWarRoomLoading(true);
    setWarRoomMessages([]);
    try {
      const result = await api.createNewWarRoom();
      setWarRoomMessages(result.messages || []);
      setWarRoomSessionId(result.session_id || "");
    } catch (e: any) {
      console.error("War room error:", e);
      toast("参谋室召唤失败，但推荐先看看~", { icon: "🐱" });
    }
    setWarRoomLoading(false);
  };

  const handleShowShopping = () => {
    if (recommendation) {
      setShoppingOpen(true);
    } else {
      toast("暂无推荐数据", { icon: "🐱" });
    }
  };

  // Build task cards from backend data
  const taskCards = sourceVideos.length > 0
    ? sourceVideos.map((v, i) => ({
        emoji: ["🥩", "⏱️", "🍜"][i % 3],
        title: v.dish_name || v.title,
        subtitle: v.title,
        tags: v.tags?.slice(0, 3) || ["美食"],
        hot: i === 0,
      }))
    : [];

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden">
      <Sparkles />

      {backendError && !loading && (
        <div className="fixed top-4 left-4 right-4 z-50 max-w-md mx-auto rounded-2xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 shadow-lg animate-pop-in">
          ⚠️ 后端连接失败: {backendError}
          <br />
          <span className="text-xs opacity-70">请确保后端已启动：python3 -m uvicorn backend.main:app --port 8001</span>
        </div>
      )}

      {page === "hook" && (
        <PageHook
          videoCount={status?.food_count || 3}
          onNext={() => go("analysis", "猫猫正在分析你的收藏视频…")}
        />
      )}

      {page === "analysis" && (
        <PageAnalysis
          videos={status?.videos || []}
          onNext={() => go("tasks", "生成推荐中…")}
        />
      )}

      {page === "tasks" && (
        <PageTasks
          cards={taskCards}
          recommendation={recommendation}
          onBack={() => setPage("analysis")}
          onPick={handleEnterAction}
          onOther={() => toast("先看看推荐的那道菜吧～", { icon: "🐱" })}
        />
      )}

      {page === "action" && (
        <PageAction
          recommendation={recommendation}
          warRoomMessages={warRoomMessages}
          warRoomLoading={warRoomLoading}
          onBack={() => setPage("tasks")}
          onShopping={handleShowShopping}
          onAdd={() => toast("已加入今晚计划：先吃好饭，再思考人生。", { icon: "✨" })}
          onShare={() => setShareOpen(true)}
        />
      )}

      {loading && <LoadingOverlay text={loading} />}
      {shoppingOpen && recommendation && (
        <ShoppingSheet ingredients={recommendation.ingredients} onClose={() => setShoppingOpen(false)} />
      )}
      {shareOpen && (
        <ShareModal
          dishName={recommendation?.title || "美食推荐"}
          onClose={() => setShareOpen(false)}
          onHome={() => { setShareOpen(false); setPage("hook"); }}
        />
      )}
    </div>
  );
}

/* ---------- Sparkles ---------- */
function Sparkles() {
  const dots = [
    { t: "8%", l: "12%", d: "0s", s: "text-2xl" },
    { t: "18%", l: "82%", d: "0.4s", s: "text-xl" },
    { t: "42%", l: "6%", d: "0.8s", s: "text-lg" },
    { t: "68%", l: "88%", d: "0.2s", s: "text-2xl" },
    { t: "88%", l: "14%", d: "0.6s", s: "text-xl" },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      {dots.map((d, i) => (
        <span key={i} className={`absolute ${d.s} animate-sparkle`} style={{ top: d.t, left: d.l, animationDelay: d.d }}>✨</span>
      ))}
    </div>
  );
}

/* ========== Page 1: Hook ========== */
function PageHook({ videoCount, onNext }: { videoCount: number; onNext: () => void }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col px-6 pt-10 pb-8 animate-pop-in">
      <p className="text-center text-sm text-foreground/60">你的收藏夹里住着一只</p>
      <h1 className="mt-1 text-center text-[88px] font-black leading-none tracking-tight text-primary drop-shadow-sm">饿猫</h1>

      <div className="relative mt-2 flex items-center justify-center">
        <div className="absolute h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <img src={catImg} alt="一只饿猫" width={768} height={768}
          className="relative h-72 w-72 object-contain animate-float-cat drop-shadow-2xl" />
        <span className="absolute right-4 top-6 text-3xl animate-wiggle">🍜</span>
        <span className="absolute left-2 bottom-10 text-3xl animate-wiggle" style={{ animationDelay: "0.4s" }}>🥟</span>
      </div>

      <div className="mt-2 rounded-[2rem] bg-gradient-card p-6 shadow-soft">
        <p className="text-center text-2xl font-bold leading-relaxed text-primary text-balance">
          一边思考人生意义，<br />一边饿到啃空气。
        </p>
        <p className="mt-3 text-center text-sm text-foreground/60">
          它发现你收藏了 <strong className="text-accent">{videoCount}</strong> 个美食视频，已经按捺不住了。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {["#深夜美食", "#想吃点好的", "#别再只收藏了"].map((t) => (
          <span key={t} className="rounded-full bg-tag px-3 py-1 text-xs font-medium text-tag-foreground">{t}</span>
        ))}
      </div>

      <button onClick={onNext}
        className="mt-auto w-full rounded-full bg-primary py-5 text-lg font-bold text-primary-foreground shadow-soft transition active:scale-95 hover:brightness-110">
        🎁 看看它叼来了什么
      </button>
    </div>
  );
}

/* ========== Page 1.5: Video Analysis Results ========== */
function PageAnalysis({ videos, onNext }: { videos: api.StatusVideo[]; onNext: () => void }) {
  // Simulate progressive reveal
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (videos.length === 0) {
      setAllDone(true);
      return;
    }
    videos.forEach((_, i) => {
      setTimeout(() => {
        setRevealed(prev => {
          const next = new Set(prev);
          next.add(i);
          if (next.size >= videos.length) {
            setTimeout(() => setAllDone(true), 600);
          }
          return next;
        });
      }, 600 + i * 800);
    });
  }, [videos.length]);

  if (videos.length === 0) {
    // Fallback: show 3 simulated cards
    return <PageAnalysisFallback onNext={onNext} />;
  }

  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <div className="text-center">
        <div className="text-5xl animate-wiggle inline-block">🐱</div>
        <h2 className="mt-3 text-2xl font-black text-primary text-balance">视频理解分析</h2>
        <p className="mt-1 text-sm text-foreground/60">猫猫正在用 AI 理解你收藏的视频...</p>
      </div>

      <div className="mt-8 space-y-4">
        {videos.map((v, i) => (
          <div
            key={v.id}
            style={{ animationDelay: `${i * 0.1}s` }}
            className={`rounded-3xl bg-gradient-card p-5 shadow-soft transition-all duration-500 ${
              revealed.has(i) ? "animate-pop-in opacity-100" : "opacity-30 blur-sm"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach/40 text-2xl">
                {["🥩", "⏱️", "🍜"][i % 3]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-primary truncate">{v.dish_name || v.title}</h3>
                  {revealed.has(i) && (
                    <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                      ✅ 已理解
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-foreground/50 truncate">{v.title}</p>
                {revealed.has(i) && (
                  <div className="mt-2 animate-pop-in">
                    <div className="flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] text-accent-foreground">
                        📂 {v.category}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-foreground/80 line-clamp-2">
                      {v.summary}
                    </p>
                  </div>
                )}
                {!revealed.has(i) && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-foreground/40">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse" />
                    正在分析视频内容…
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl bg-gradient-card p-4 text-center shadow-soft">
        <p className="text-sm text-foreground/70">
          🧠 使用 <strong className="text-accent">doubao-seed-2-0-lite-260215</strong> 完成视频理解
        </p>
      </div>

      {allDone && (
        <button onClick={onNext}
          className="mt-6 w-full rounded-full bg-primary py-5 text-lg font-bold text-primary-foreground shadow-soft active:scale-95 animate-pop-in">
          🎯 看看综合推荐 →
        </button>
      )}
    </div>
  );
}

/* Fallback if no video data */
function PageAnalysisFallback({ onNext }: { onNext: () => void }) {
  const fallback = [
    { emoji: "🥩", title: "超软烂土豆炖牛腩", summary: "经典家常炖菜，牛腩软烂入味，土豆绵密，汤汁浓郁。", done: true },
    { emoji: "⏱️", title: "一周备餐｜懒人快手菜", summary: "简单快手的家常小炒，食材灵活，适合日常。", done: true },
    { emoji: "🍜", title: "番茄鸡蛋面教程", summary: "一碗温暖的汤面，简单又满足。", done: true },
  ];

  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <div className="text-center">
        <div className="text-5xl animate-wiggle inline-block">🐱</div>
        <h2 className="mt-3 text-2xl font-black text-primary text-balance">视频理解分析</h2>
        <p className="mt-1 text-sm text-foreground/60">猫猫正在用 AI 理解你收藏的视频...</p>
      </div>

      <div className="mt-8 space-y-4">
        {fallback.map((v, i) => (
          <div key={i} className="rounded-3xl bg-gradient-card p-5 shadow-soft animate-pop-in"
            style={{ animationDelay: `${i * 0.3}s` }}>
            <div className="flex items-start gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-peach/40 text-2xl">{v.emoji}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-primary truncate">{v.title}</h3>
                  <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">✅ 已理解</span>
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground/80">{v.summary}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px]">📂 美食</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <button onClick={onNext}
        className="mt-6 w-full rounded-full bg-primary py-5 text-lg font-bold text-primary-foreground shadow-soft active:scale-95">
        🎯 看看综合推荐 →
      </button>
    </div>
  );
}

/* ========== Page 2: Task Cards ========== */
function PageTasks({
  cards, recommendation, onBack, onPick, onOther,
}: {
  cards: { emoji: string; title: string; subtitle: string; tags: string[]; hot: boolean }[];
  recommendation: api.Recommendation | null;
  onBack: () => void;
  onPick: () => void;
  onOther: () => void;
}) {
  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <button onClick={onBack} className="text-sm text-foreground/50 hover:text-foreground">← 返回</button>

      <div className="mt-6 text-center">
        <div className="text-5xl animate-wiggle inline-block">🐾</div>
        <h2 className="mt-3 text-3xl font-black text-primary text-balance">
          猫猫叼来了 <span className="text-accent">{cards.length}</span> 件小事
        </h2>
        <p className="mt-1 text-sm text-foreground/60">基于视频理解分析推荐</p>
      </div>

      {/* AI recommendation summary */}
      {recommendation && (
        <div className="mt-5 rounded-3xl bg-primary p-4 text-primary-foreground shadow-soft animate-pop-in">
          <div className="flex items-center gap-1.5 text-xs opacity-70">
            <span>🧠</span>
            <span>综合推荐</span>
          </div>
          <p className="mt-2 text-lg font-bold">{recommendation.title}</p>
          <p className="mt-1 text-sm opacity-80">{recommendation.description}</p>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {cards.map((c, i) => (
          <button
            key={c.title}
            onClick={i === 0 ? onPick : onOther}
            style={{ animationDelay: `${i * 0.08}s` }}
            className="group relative block w-full overflow-hidden rounded-3xl bg-gradient-card p-5 text-left shadow-soft transition active:scale-[0.98] animate-pop-in"
          >
            {c.hot && (
              <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                综合推荐 ✨
              </span>
            )}
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-peach/40 text-3xl">{c.emoji}</div>
              <div className="flex-1 min-w-0">
                <h3 className="text-xl font-bold text-primary truncate">{c.title}</h3>
                <p className="mt-0.5 text-xs text-foreground/50 truncate">{c.subtitle}</p>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full bg-tag px-2.5 py-1 text-xs text-tag-foreground">{t}</span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ========== Page 3: Action + War Room ========== */
function PageAction({
  recommendation, warRoomMessages, warRoomLoading, onBack, onShopping, onAdd, onShare,
}: {
  recommendation: api.Recommendation | null;
  warRoomMessages: api.WarRoomMessage[];
  warRoomLoading: boolean;
  onBack: () => void;
  onShopping: () => void;
  onAdd: () => void;
  onShare: () => void;
}) {
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [visibleMsgs, setVisibleMsgs] = useState(0);

  // Progressive reveal of war room messages
  useEffect(() => {
    if (warRoomMessages.length === 0) return;
    // Filter out system messages for display
    const agentMsgs = warRoomMessages.filter(m => m.agent_role !== "system");
    if (agentMsgs.length === 0) return;

    const interval = setInterval(() => {
      setVisibleMsgs(prev => {
        if (prev >= agentMsgs.length) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 600);

    return () => clearInterval(interval);
  }, [warRoomMessages]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [visibleMsgs, warRoomMessages]);

  const displayName = recommendation?.title || "美食推荐";
  const steps = recommendation?.steps || [];
  const tips = recommendation?.tips || "";

  // Get agent messages for display
  const agentMessages = warRoomMessages.filter(m => m.agent_role !== "system");

  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <button onClick={onBack} className="text-sm text-foreground/50 hover:text-foreground">← 返回</button>

      <div className="mt-5">
        <h2 className="text-3xl font-black text-primary text-balance">{displayName}</h2>
        <p className="mt-2 text-sm text-foreground/60">{recommendation?.description || "收藏的美食视频综合分析推荐"}</p>
      </div>

      {/* Steps */}
      {steps.length > 0 && (
        <div className="mt-5 rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft">
          <div className="flex items-center gap-2 text-xs opacity-70">
            <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5">推荐做法</span>
            <span>· {steps.length} 步</span>
          </div>
          <div className="mt-3 space-y-2">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary-foreground/20 text-xs font-bold">{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          {tips && <p className="mt-3 text-xs opacity-80">💡 {tips}</p>}
        </div>
      )}

      {/* War Room */}
      <div className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-bold text-primary">🤖 参谋聊天室</h3>
          <span className="text-xs text-foreground/50">
            · {warRoomLoading ? "参谋正在讨论中…" : `${agentMessages.length} 位参谋已发言`}
          </span>
        </div>

        {(warRoomLoading && agentMessages.length === 0) && (
          <div className="flex flex-col items-center gap-2 py-8 text-sm text-foreground/50">
            <div className="text-3xl animate-wiggle">😺</div>
            <p>正在召唤各位参谋…</p>
            <div className="flex gap-3 mt-2">
              {["🍳", "🧂", "🥗", "💰"].map((e, i) => (
                <span key={i} className="text-2xl animate-bounce" style={{ animationDelay: `${i * 0.2}s` }}>{e}</span>
              ))}
            </div>
          </div>
        )}

        {agentMessages.length > 0 && (
          <div className="rounded-3xl bg-gradient-card p-4 shadow-soft">
            {/* Agent status bar */}
            <div className="flex items-center justify-between mb-4 px-1">
              {[
                { emoji: "🍳", name: "懒人厨子" },
                { emoji: "🧂", name: "配料大师" },
                { emoji: "🥗", name: "营养顾问" },
                { emoji: "💰", name: "省钱参谋" },
              ].map((a, i) => {
                const hasSpoken = agentMessages.some(m => m.agent_name === a.name);
                const isSpeaking = hasSpoken && visibleMsgs > i;
                return (
                  <div key={a.name} className={`flex flex-col items-center gap-1 transition-opacity ${hasSpoken ? "opacity-100" : "opacity-40"}`}>
                    <span className={`text-xl ${isSpeaking ? "animate-bounce" : ""}`}>{a.emoji}</span>
                    <span className="text-[9px] text-foreground/60 whitespace-nowrap">{a.name}</span>
                    {hasSpoken && <span className="text-[8px] text-green-600">✅</span>}
                  </div>
                );
              })}
            </div>

            {/* Messages */}
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {agentMessages.slice(0, visibleMsgs).map((m, i) => (
                <div key={i}
                  className={`flex items-end gap-2 animate-bubble-in ${i % 2 === 0 ? "" : "flex-row-reverse"}`}>
                  <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-card text-base shadow-sm">
                    {m.agent_emoji || "🤖"}
                  </div>
                  <div className={`max-w-[78%] ${i % 2 === 0 ? "items-start" : "items-end"} flex flex-col`}>
                    <span className="mb-1 px-1 text-[10px] text-foreground/50">{m.agent_name}</span>
                    <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-primary shadow-sm ${
                      i % 2 === 0 ? "bg-cream rounded-bl-sm" : "bg-peach/60 rounded-br-sm"
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {warRoomLoading && (
                <div className="flex items-center gap-2 py-3 text-sm text-foreground/50 animate-pulse">
                  <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                  <span>参谋们正在深入讨论…</span>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          </div>
        )}

        {agentMessages.length === 0 && !warRoomLoading && (
          <div className="rounded-3xl bg-gradient-card p-6 text-center shadow-soft">
            <p className="text-sm text-foreground/60">点击推荐卡片后，4 位参谋将为你讨论最佳做法 🍳</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-3">
        <button onClick={onShopping}
          className="w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground shadow-soft active:scale-95">
          🛒 看采购单
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={onAdd}
            className="rounded-full bg-card py-3.5 text-sm font-bold text-primary shadow-soft active:scale-95">
            ✅ 加入今晚计划
          </button>
          <button onClick={onShare}
            className="rounded-full bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-soft active:scale-95">
            💌 分享我的饿猫
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Overlays ---------- */
function LoadingOverlay({ text }: { text: string }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 backdrop-blur-md animate-pop-in">
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-card px-8 py-6 shadow-soft">
        <div className="text-5xl animate-wiggle">🐱</div>
        <p className="text-sm font-bold text-primary">{text}</p>
        <div className="flex gap-1 mt-1">
          {["🍳", "🧂", "🥗", "💰"].map((e, i) => (
            <span key={i} className="text-lg animate-bounce" style={{ animationDelay: `${i * 0.15}s` }}>{e}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function ShoppingSheet({ ingredients, onClose }: { ingredients: string[]; onClose: () => void }) {
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[2.5rem] bg-card p-6 pb-8 shadow-soft animate-slide-up">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <h3 className="text-2xl font-black text-primary">🛒 采购清单</h3>
        <ShoppingGroup title="食材" items={ingredients} />
        <p className="mt-5 rounded-2xl bg-peach/40 px-4 py-3 text-sm text-primary">🐱 缺一两个也没关系，今天的目标是吃上饭。</p>
        <button onClick={onClose} className="mt-5 w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground active:scale-95">知道了</button>
      </div>
    </div>
  );
}

function ShoppingGroup({ title, items, muted }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div className="mt-5">
      <p className="mb-2 text-xs font-bold uppercase tracking-wide text-foreground/50">{title}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((i) => (
          <span key={i} className={`rounded-full px-3 py-1.5 text-sm ${muted ? "bg-muted text-muted-foreground" : "bg-tag text-tag-foreground"}`}>{i}</span>
        ))}
      </div>
    </div>
  );
}

function ShareModal({ dishName, onClose, onHome }: { dishName: string; onClose: () => void; onHome: () => void }) {
  useEffect(() => { document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = ""; }; }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-5 backdrop-blur-sm" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2rem] bg-gradient-card p-6 shadow-glow animate-pop-in">
        <div className="rounded-3xl bg-gradient-warm p-6 text-center shadow-soft">
          <img src={catImg} alt="" width={768} height={768} loading="lazy" className="mx-auto h-32 w-32 animate-float-cat" />
          <p className="mt-2 text-xs text-primary/60">收藏夹小参谋</p>
          <h3 className="mt-1 text-2xl font-black text-primary text-balance">我的收藏夹里<br />住着一只饿猫</h3>
          <p className="mt-3 text-sm font-medium leading-relaxed text-primary/80">一边思考人生意义，<br />一边饿到啃空气。</p>
          <div className="mt-4 rounded-2xl bg-card/70 px-3 py-2 text-xs text-primary">它今天给我叼来了一个任务：<b>{dishName}</b></div>
          <p className="mt-3 text-sm font-bold text-accent">🍲 今晚建议：先把饭吃好，<br />再考虑人生有没有意义。</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-full bg-card py-3 text-sm font-bold text-primary active:scale-95">返回</button>
          <button onClick={onHome} className="rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-95">回到首页</button>
        </div>
      </div>
    </div>
  );
}
