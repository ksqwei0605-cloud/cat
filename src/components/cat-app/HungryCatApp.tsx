import { useState, useEffect } from "react";
import { toast } from "sonner";
import catImg from "@/assets/hungry-cat.png";

type Page = "hook" | "tasks" | "action";

export function HungryCatApp() {
  const [page, setPage] = useState<Page>("hook");
  const [loading, setLoading] = useState<string | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const go = (next: Page, msg: string) => {
    setLoading(msg);
    setTimeout(() => {
      setPage(next);
      setLoading(null);
      window.scrollTo({ top: 0 });
    }, 800);
  };

  return (
    <div className="relative mx-auto min-h-screen w-full max-w-md overflow-hidden">
      <Sparkles />
      {page === "hook" && <PageHook onNext={() => go("tasks", "猫猫正在翻你的收藏夹…")} />}
      {page === "tasks" && (
        <PageTasks
          onBack={() => setPage("hook")}
          onPick={() => go("action", "正在召唤参谋聊天室…")}
          onOther={() => toast("Demo 里先看看土豆牛腩计划吧～", { icon: "🐱" })}
        />
      )}
      {page === "action" && (
        <PageAction
          onBack={() => setPage("tasks")}
          onShopping={() => setShoppingOpen(true)}
          onAdd={() => toast("已加入今晚计划：先吃好饭，再思考人生。", { icon: "✨" })}
          onShare={() => setShareOpen(true)}
        />
      )}

      {loading && <LoadingOverlay text={loading} />}
      {shoppingOpen && <ShoppingSheet onClose={() => setShoppingOpen(false)} />}
      {shareOpen && (
        <ShareModal
          onClose={() => setShareOpen(false)}
          onHome={() => {
            setShareOpen(false);
            setPage("hook");
          }}
        />
      )}
    </div>
  );
}

/* ---------- Decorative ---------- */
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
        <span
          key={i}
          className={`absolute ${d.s} animate-sparkle`}
          style={{ top: d.t, left: d.l, animationDelay: d.d }}
        >
          ✨
        </span>
      ))}
    </div>
  );
}

/* ---------- Page 1 ---------- */
function PageHook({ onNext }: { onNext: () => void }) {
  return (
    <div className="relative z-10 flex min-h-screen flex-col px-6 pt-10 pb-8 animate-pop-in">
      <p className="text-center text-sm text-foreground/60">你的收藏夹里住着一只</p>

      <h1 className="mt-1 text-center text-[88px] font-black leading-none tracking-tight text-primary drop-shadow-sm">
        饿猫
      </h1>

      <div className="relative mt-2 flex items-center justify-center">
        <div className="absolute h-64 w-64 rounded-full bg-accent/30 blur-3xl" />
        <img
          src={catImg}
          alt="一只饿猫"
          width={768}
          height={768}
          className="relative h-72 w-72 object-contain animate-float-cat drop-shadow-2xl"
        />
        <span className="absolute right-4 top-6 text-3xl animate-wiggle">🍜</span>
        <span className="absolute left-2 bottom-10 text-3xl animate-wiggle" style={{ animationDelay: "0.4s" }}>🥟</span>
      </div>

      <div className="mt-2 rounded-[2rem] bg-gradient-card p-6 shadow-soft">
        <p className="text-center text-2xl font-bold leading-relaxed text-primary text-balance">
          一边思考人生意义，<br />一边饿到啃空气。
        </p>
        <p className="mt-3 text-center text-sm text-foreground/60">
          它每天蹲守你的「想吃」清单。
        </p>
      </div>

      <div className="mt-5 flex flex-wrap justify-center gap-2">
        {["#深夜美食", "#想吃点好的", "#别再只收藏了"].map((t) => (
          <span key={t} className="rounded-full bg-tag px-3 py-1 text-xs font-medium text-tag-foreground">
            {t}
          </span>
        ))}
      </div>

      <button
        onClick={onNext}
        className="mt-auto w-full rounded-full bg-primary py-5 text-lg font-bold text-primary-foreground shadow-soft transition active:scale-95 hover:brightness-110"
      >
        🎁 看看它叼来了什么
      </button>
    </div>
  );
}

/* ---------- Page 2 ---------- */
function PageTasks({
  onBack,
  onPick,
  onOther,
}: {
  onBack: () => void;
  onPick: () => void;
  onOther: () => void;
}) {
  const cards = [
    {
      emoji: "🥩",
      title: "土豆牛腩计划",
      line: "你 3 天前收藏的，今晚试试？",
      tags: ["食材清单", "懒人做法", "替代方案"],
      hot: true,
      onClick: onPick,
    },
    {
      emoji: "⏱️",
      title: "30 分钟晚饭",
      line: "不想点外卖，就做这个。",
      tags: ["快手菜", "一人食", "不想点外卖"],
      onClick: onOther,
    },
    {
      emoji: "💸",
      title: "省钱做饭计划",
      line: "把收藏夹变成这周菜单。",
      tags: ["低成本", "学生党", "买菜清单"],
      onClick: onOther,
    },
  ];

  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <button onClick={onBack} className="text-sm text-foreground/50 hover:text-foreground">
        ← 返回
      </button>

      <div className="mt-6 text-center">
        <div className="text-5xl animate-wiggle inline-block">🐾</div>
        <h2 className="mt-3 text-3xl font-black text-primary text-balance">
          猫猫叼来了 <span className="text-accent">3</span> 件小事
        </h2>
      </div>

      <div className="mt-8 space-y-4">
        {cards.map((c, i) => (
          <button
            key={c.title}
            onClick={c.onClick}
            style={{ animationDelay: `${i * 0.08}s` }}
            className="group relative block w-full overflow-hidden rounded-3xl bg-gradient-card p-5 text-left shadow-soft transition active:scale-[0.98] animate-pop-in"
          >
            {c.hot && (
              <span className="absolute right-4 top-4 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold text-accent-foreground">
                今日推荐 ✨
              </span>
            )}
            <div className="flex items-start gap-3">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-peach/40 text-3xl">
                {c.emoji}
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-primary">{c.title}</h3>
                <p className="mt-1 text-sm text-foreground/70">{c.line}</p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-1.5">
              {c.tags.map((t) => (
                <span key={t} className="rounded-full bg-tag px-2.5 py-1 text-xs text-tag-foreground">
                  {t}
                </span>
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- Page 3 ---------- */
function PageAction({
  onBack,
  onShopping,
  onAdd,
  onShare,
}: {
  onBack: () => void;
  onShopping: () => void;
  onAdd: () => void;
  onShare: () => void;
}) {
  const chat = [
    { who: "懒人厨子", emoji: "🍳", text: "今晚能做，别搞复杂，直接一锅炖。", align: "left" as const, bg: "bg-cream" },
    { who: "采购参谋", emoji: "🛒", text: "先确认这几个：牛腩、土豆、洋葱、番茄。", align: "right" as const, bg: "bg-peach/60" },
    { who: "省钱参谋", emoji: "💰", text: "牛腩贵就换鸡腿，幸福感少一点，钱包能活。", align: "left" as const, bg: "bg-cream" },
    { who: "氛围小猫", emoji: "🐱", text: "总之先吃饭，再想人生。", align: "right" as const, bg: "bg-accent/30" },
  ];

  return (
    <div className="relative z-10 min-h-screen px-5 pt-6 pb-10 animate-slide-up">
      <button onClick={onBack} className="text-sm text-foreground/50 hover:text-foreground">
        ← 返回
      </button>

      <div className="mt-5">
        <h2 className="text-3xl font-black text-primary text-balance">土豆牛腩，今晚开做</h2>
        <p className="mt-2 text-sm text-foreground/60">你 3 天前收藏的，今天可以兑现了。</p>
      </div>

      {/* Task card */}
      <div className="mt-5 rounded-3xl bg-primary p-5 text-primary-foreground shadow-soft">
        <div className="flex items-center gap-2 text-xs opacity-70">
          <span className="rounded-full bg-primary-foreground/20 px-2 py-0.5">今日任务</span>
          <span>· 估计 60 分钟</span>
        </div>
        <p className="mt-3 text-xl font-bold">推荐路线：懒人一锅炖</p>
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-primary-foreground/10 px-4 py-3 text-sm">
          <span>🫧 焯水</span>
          <span className="opacity-50">→</span>
          <span>🔪 切块</span>
          <span className="opacity-50">→</span>
          <span>🍲 一锅炖</span>
        </div>
      </div>

      {/* Chat */}
      <div className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-lg font-bold text-primary">参谋聊天室</h3>
          <span className="text-xs text-foreground/50">· 4 位参谋在线</span>
        </div>
        <div className="space-y-3">
          {chat.map((m, i) => (
            <div
              key={i}
              style={{ animationDelay: `${i * 0.15}s` }}
              className={`flex items-end gap-2 animate-bubble-in ${
                m.align === "right" ? "flex-row-reverse" : ""
              }`}
            >
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-lg shadow-sm">
                {m.emoji}
              </div>
              <div className={`max-w-[78%] ${m.align === "right" ? "items-end" : "items-start"} flex flex-col`}>
                <span className="mb-1 px-1 text-[10px] text-foreground/50">{m.who}</span>
                <div
                  className={`${m.bg} rounded-2xl px-4 py-2.5 text-sm leading-relaxed text-primary shadow-sm ${
                    m.align === "right" ? "rounded-br-sm" : "rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-8 space-y-3">
        <button
          onClick={onShopping}
          className="w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground shadow-soft active:scale-95"
        >
          🛒 看采购单
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={onAdd}
            className="rounded-full bg-card py-3.5 text-sm font-bold text-primary shadow-soft active:scale-95"
          >
            ✅ 加入今晚计划
          </button>
          <button
            onClick={onShare}
            className="rounded-full bg-accent py-3.5 text-sm font-bold text-accent-foreground shadow-soft active:scale-95"
          >
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
      </div>
    </div>
  );
}

function ShoppingSheet({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-primary/40 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-t-[2.5rem] bg-card p-6 pb-8 shadow-soft animate-slide-up"
      >
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-border" />
        <h3 className="text-2xl font-black text-primary">🛒 土豆牛腩采购单</h3>

        <ShoppingGroup title="主食材" items={["牛腩 500g", "土豆 2 个", "洋葱半个", "番茄 1 个"]} />
        <ShoppingGroup title="调料" items={["生抽", "老抽", "料酒", "盐", "冰糖"]} />
        <ShoppingGroup title="可选" items={["八角", "香叶"]} muted />

        <p className="mt-5 rounded-2xl bg-peach/40 px-4 py-3 text-sm text-primary">
          🐱 缺一两个香料也没关系，今天的目标是吃上饭。
        </p>

        <button
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-primary py-4 text-base font-bold text-primary-foreground active:scale-95"
        >
          知道了
        </button>
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
          <span
            key={i}
            className={`rounded-full px-3 py-1.5 text-sm ${
              muted ? "bg-muted text-muted-foreground" : "bg-tag text-tag-foreground"
            }`}
          >
            {i}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareModal({ onClose, onHome }: { onClose: () => void; onHome: () => void }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-primary/50 p-5 backdrop-blur-sm" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-[2rem] bg-gradient-card p-6 shadow-glow animate-pop-in"
      >
        <div className="rounded-3xl bg-gradient-warm p-6 text-center shadow-soft">
          <img src={catImg} alt="" width={768} height={768} loading="lazy" className="mx-auto h-32 w-32 animate-float-cat" />
          <p className="mt-2 text-xs text-primary/60">收藏夹小参谋</p>
          <h3 className="mt-1 text-2xl font-black text-primary text-balance">
            我的收藏夹里<br />住着一只饿猫
          </h3>
          <p className="mt-3 text-sm font-medium leading-relaxed text-primary/80">
            一边思考人生意义，<br />一边饿到啃空气。
          </p>
          <div className="mt-4 rounded-2xl bg-card/70 px-3 py-2 text-xs text-primary">
            它今天给我叼来了一个任务：<b>土豆牛腩计划</b>
          </div>
          <p className="mt-3 text-sm font-bold text-accent">
            🍲 今晚建议：先把饭吃好，<br />再考虑人生有没有意义。
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button onClick={onClose} className="rounded-full bg-card py-3 text-sm font-bold text-primary active:scale-95">
            返回
          </button>
          <button onClick={onHome} className="rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground active:scale-95">
            回到首页
          </button>
        </div>
      </div>
    </div>
  );
}
