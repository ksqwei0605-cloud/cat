#!/bin/bash
# 饿猫 - 收藏夹智能参谋系统 启动脚本
# 启动后端 FastAPI + 前端 Vite 开发服务器

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "================================"
echo "  饿猫 · 启动中..."
echo "================================"

# 1. Start backend
echo ""
echo "▶ 启动后端 (FastAPI + LangGraph + SQLite)..."
cd "$SCRIPT_DIR"
python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 8001 --reload &
BACKEND_PID=$!
echo "  后端 PID: $BACKEND_PID (端口 8001)"

sleep 2

# Test backend
if curl -sf http://localhost:8001/api/health > /dev/null 2>&1; then
  echo "  ✅ 后端运行中"
else
  echo "  ⚠️ 后端启动可能失败，请检查"
fi

# 2. Start frontend
echo ""
echo "▶ 启动前端 (Vite + React)..."
cd "$SCRIPT_DIR"
bun run dev --port 5173 &
FRONTEND_PID=$!
echo "  前端 PID: $FRONTEND_PID (端口 5173)"

echo ""
echo "================================"
echo "  系统已启动!"
echo "  前端: http://localhost:5173"
echo "  后端: http://localhost:8001"
echo "  API 文档: http://localhost:8001/docs"
echo "================================"
echo "  按 Ctrl+C 停止所有服务"
echo "================================"

# Trap to kill both on exit
trap "echo '正在停止...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
