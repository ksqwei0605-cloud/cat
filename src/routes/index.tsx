import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { HungryCatApp } from "@/components/cat-app/HungryCatApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "收藏夹小参谋 · 饿猫帮你把收藏变成行动" },
      {
        name: "description",
        content: "你的收藏夹里住着一只饿猫，它叼出你今天真的能做的事，再叫几个 AI 小参谋帮你行动。",
      },
      { property: "og:title", content: "收藏夹小参谋 · 饿猫" },
      { property: "og:description", content: "把美食收藏夹变成今晚的一顿饭。" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&display=swap",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <>
      <HungryCatApp />
      <Toaster
        position="top-center"
        toastOptions={{
          style: {
            background: "var(--color-primary)",
            color: "var(--color-primary-foreground)",
            border: "none",
            borderRadius: "9999px",
            fontFamily: "var(--font-display)",
          },
        }}
      />
    </>
  );
}
