# 🎯 OSE v2.0 Quick Reference Card

## 60-Second Overview

**What**: Institutional-grade AI agent orchestration dashboard  
**Why**: Autonomous trading with multi-agent decision pipeline  
**Status**: Production-ready ✅  

## Start in 3 Steps

```bash
# 1. Backend
cd backend && cp .env.example .env
# Edit .env with your Supabase & Anthropic keys
pip install -r requirements.txt && python main.py

# 2. Frontend  
npm install && npm run dev

# 3. Open Browser
http://localhost:5173
```

## What You Get

### 🎨 Frontend
- Real-time charts (Recharts)
- Agent command center
- Trading dashboard
- WebSocket updates (30ms latency)

### 🧠 Backend
- 4-agent AI orchestration
- Connection pooling (20 connections)
- RESTful API + WebSocket
- 19 Python modules

### 🔒 Security
- Environment validation
- Session-based RLS
- Startup security checks

## Key Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/health/` | GET | System status |
| `/api/agents/status` | GET | Agent status |
| `/api/agents/analyze` | POST | Run analysis |
| `/api/commands/execute` | POST | Execute command |
| `/api/trading/hooks` | GET | List hooks |
| `/ws/api/realtime/ws/{id}` | WS | Real-time updates |

## Configuration

```env
# Required
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_KEY=xxx
ANTHROPIC_API_KEY=sk-ant-api03-xxx
API_KEY_SECRET=xxx

# Optional (defaults shown)
DB_POOL_SIZE=20
LOG_LEVEL=INFO
PORT=8000
```

## Performance

| Metric | Value |
|--------|-------|
| Startup | ~3s |
| Agent Response | ~1.5s |
| Chart Update | 50ms |
| WebSocket | 30ms |
| Frontend Size | 671KB |

## 4-Agent Pipeline

```
Market Analysis
    ↓
Risk Assessment
    ↓
Execution Planning
    ↓
Strategic Review
    ↓
Final Decision
```

## File Structure

```
backend/          (Python FastAPI)
├── main.py       (entry)
├── app/core/     (config, logging)
├── app/db/       (pooling, supabase)
├── app/services/ (agents)
└── app/api/      (routes)

src/              (React + TypeScript)
├── App.tsx       (unified UI)
├── lib/          (supabase, session)
└── index.css     (dark theme)
```

## Deployment

```bash
# Docker
docker build -f backend/Dockerfile -t ose:2.0 .
docker run -e SUPABASE_URL=... ose:2.0

# Production Build
npm run build
# Output: dist/ folder
```

## Monitoring

```bash
# Health Check (add to load balancer)
curl http://localhost:8000/api/health/

# API Docs (Swagger UI)
http://localhost:8000/docs

# Logs
LOG_LEVEL=DEBUG python main.py
```

## Common Issues

| Issue | Fix |
|-------|-----|
| "Missing env variables" | Copy .env.example → .env, add credentials |
| "DB connection failed" | Verify SUPABASE_SERVICE_KEY |
| "Agents not responding" | Check ANTHROPIC_API_KEY and rate limits |
| "WebSocket not updating" | Verify ENABLE_REALTIME=true |

## Documentation Files

- **README.md** — Feature guide
- **ARCHITECTURE.md** — System design
- **DEPLOYMENT.md** — Production guide
- **UPGRADE_SUMMARY.md** — What was built

## Key Features

✅ Real-time AI agent orchestration  
✅ 4-stage decision pipeline  
✅ Live charting (Recharts)  
✅ WebSocket streaming  
✅ Connection pooling  
✅ Session security  
✅ Environment validation  
✅ Professional UI  

## Building More

### Add New Agent
```python
# backend/app/services/agent_orchestration.py
configs = [
    AgentConfig(
        role=AgentRole.YOUR_ROLE,
        name="Your Agent",
        system_prompt="Your custom prompt"
    )
]
```

### Add New API Route
```python
# backend/app/api/routes/new_route.py
@router.post("/endpoint")
async def your_endpoint(request: YourModel):
    return {"result": "data"}
```

### Add New Chart
```tsx
// src/App.tsx
<ResponsiveContainer width="100%" height={250}>
  <LineChart data={chartData}>
    {/* your chart */}
  </LineChart>
</ResponsiveContainer>
```

## Support

- Swagger UI: http://localhost:8000/docs
- Logs: Check console output
- Health: http://localhost:8000/api/health/

---

**Status**: Production Ready ✅  
**Version**: 2.0  
**Last Updated**: 2026-06-03  

Built for serious automation.
