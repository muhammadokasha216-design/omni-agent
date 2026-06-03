# OSE — Omni-System Executive v2.0
## Institutional-Grade AI Agent Orchestration Dashboard

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Dashboard │ AI Terminal │ Trading │ Agent Command    │   │
│  │           │ with COT    │ Dashboard│ Center         │   │
│  └──────────────────────────────────────────────────────┘   │
│  • Real-time Charts (Recharts)                               │
│  • WebSocket Real-time Updates                              │
│  • Session-based Authentication                             │
└─────────────────────────────────────────────────────────────┘
         ↑↓ REST API + WebSocket
┌─────────────────────────────────────────────────────────────┐
│         Backend (FastAPI + SQLAlchemy)                      │
│  ┌─ API Layer ──────────────────────────────────────────┐   │
│  │ /api/health  /api/commands  /api/agents             │   │
│  │ /api/trading /api/realtime  /ws (WebSocket)         │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌─ Services Layer ──────────────────────────────────────┐   │
│  │ Agent Orchestration (Multi-agent Pipeline)           │   │
│  │ • Market Analyst → Risk Manager → Execution → Review │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌─ Data Layer ──────────────────────────────────────────┐   │
│  │ SQLAlchemy Connection Pooling (20 connections)       │   │
│  │ Supabase Real-time Subscriptions                     │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
         ↑↓ Database / Real-time
┌─────────────────────────────────────────────────────────────┐
│         Supabase (PostgreSQL)                               │
│  • devices  • command_history  • trading_hooks              │
│  • webhook_logs  • sessions  • Real-time Subscriptions      │
└─────────────────────────────────────────────────────────────┘
```

## Features

### 1. Modular Backend Architecture
- **Services Layer**: Agent Orchestration Brain with 4 specialized agents
- **Controllers**: Organized API routes with clear responsibility separation
- **Models**: Pydantic models for type safety and validation
- **Utils**: Core config, logging, validation, and security modules

### 2. Database Resilience
- **SQLAlchemy AsyncIO**: Asynchronous database operations
- **Connection Pooling**: 20 persistent connections with automatic recycling
- **Pool Management**: Queue-based pool with 8s timeout
- **Health Checks**: `pool_pre_ping=True` validates connections before use
- **Failover Ready**: Async context managers for proper resource cleanup

### 3. Agent Orchestration Brain
Four specialized Claude agents working in pipeline:
1. **Market Analyst** — Analyzes market conditions and trends
2. **Risk Manager** — Evaluates risks and constraints
3. **Execution Engine** — Plans trade execution with optimal timing
4. **Strategic Advisor** — Reviews and finalizes decisions

Each agent maintains conversation history and specialization.

### 4. Real-time Streaming
- **Supabase Real-time**: Subscribe to table changes (INSERT/UPDATE/DELETE)
- **WebSocket Broadcasting**: Server-push updates to all connected clients
- **Event-driven Architecture**: Automatic UI updates without polling
- **Multi-topic Support**: commands, agents, trades, market data

### 5. Security Hardening
- **Environment Validation**: Startup fails if required keys are missing
- **Placeholder Detection**: Refuses to start with test credentials
- **Key Masking**: Sensitive keys masked in logs
- **Session Management**: Unique sessions with 30-day expiration
- **RLS Policies**: Database-level row-level security via session validation

### 6. Advanced UI
- **Trading Terminal Aesthetic**: Dark mode with cyan/green accents
- **Real-time Charts**: Recharts integration with live price and volume data
- **Agent Status Command Center**: Visual dashboard of all 4 agents
- **Responsive Design**: Mobile-first layout with proper breakpoints
- **Institutional Branding**: Professional color scheme and typography

## Backend Setup & Deployment

### Prerequisites
```bash
Python 3.10+
FastAPI 0.109.0
Uvicorn 0.27.0
PostgreSQL (via Supabase)
Anthropic API Key
```

### Installation
```bash
cd backend
pip install -r requirements.txt
```

### Configuration
```bash
cp .env.example .env
# Edit .env with your Supabase and Anthropic credentials
```

### Running the Server
```bash
python main.py
# Server starts on http://localhost:8000
# API documentation: http://localhost:8000/docs
```

### API Endpoints

#### Health Checks
- `GET /api/health/` — Overall system health
- `GET /api/health/db` — Database connectivity
- `GET /api/health/agents` — Agent orchestration status

#### Commands
- `POST /api/commands/execute` — Execute a command
- `GET /api/commands/history` — Recent command history

#### Agents
- `GET /api/agents/status` — All agents operational status
- `POST /api/agents/analyze` — Run agent analysis pipeline
- `POST /api/agents/agent/{role}/prompt` — Send prompt to specific agent

#### Trading
- `GET /api/trading/hooks` — List all trading hooks
- `POST /api/trading/hooks` — Create new hook
- `POST /api/trading/hooks/{id}/execute` — Execute a hook

#### Real-time
- `WS /api/realtime/ws/{client_id}` — WebSocket connection
- `GET /api/realtime/topics` — Available real-time topics

## Frontend

### Build
```bash
npm install
npm run build
```

### Pages
1. **Dashboard**: System overview with real-time charts
2. **AI Terminal**: Command interface with AI processing
3. **Trading Dashboard**: Hook management and market tickers
4. **Agent Command Center**: Visual agent orchestration pipeline

### Real-time Features
- Live price charts (Recharts)
- WebSocket-based command feed updates
- Agent status monitoring
- Trading hook execution feedback

## Institutional Grade Features

### Performance
- ✅ Async/await throughout (zero blocking operations)
- ✅ Connection pooling (20 concurrent DB connections)
- ✅ Real-time event streaming (sub-second updates)
- ✅ Chunked data handling (pagination ready)
- ✅ Efficient chart rendering (30-point rolling window)

### Reliability
- ✅ Database health checks on startup
- ✅ Graceful error handling and logging
- ✅ Session timeout management
- ✅ WebSocket reconnection support
- ✅ Connection recycling (1-hour recycle)

### Security
- ✅ Environment validation (refuses to start if keys missing)
- ✅ Placeholder key detection (prevents accidental credential leak)
- ✅ Row-level security (RLS via session validation)
- ✅ API key protection (not exposed in client code)
- ✅ CORS configuration (origins configurable)

### Observability
- ✅ Structured logging (all events timestamped)
- ✅ Agent conversation tracking
- ✅ Command audit trail (full command history)
- ✅ Performance metrics (latency in all responses)
- ✅ Health endpoint monitoring

## Deployment Considerations

### Docker
```dockerfile
FROM python:3.10-slim
WORKDIR /app
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
CMD ["python", "main.py"]
```

### Environment Variables (Production)
```env
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO
DEBUG=false
SUPABASE_URL=<your-project>.supabase.co
SUPABASE_ANON_KEY=<key>
SUPABASE_SERVICE_KEY=<key>
ANTHROPIC_API_KEY=sk-ant-api03-<key>
API_KEY_SECRET=<generate-random-secret>
DB_POOL_SIZE=30
ENABLE_REALTIME=true
```

### Monitoring
- API health checks every 30s
- Database connection pool metrics
- Agent response times
- Command success/failure rates
- WebSocket connection counts

## What's Next

### Phase 3 (Future)
- [ ] Multi-user workspace support (org-level features)
- [ ] Advanced permission system (role-based access)
- [ ] Agent fine-tuning per strategy
- [ ] Backtesting integration
- [ ] Live market data integration (Alpaca, Binance)
- [ ] Portfolio performance dashboard
- [ ] Alert system (Slack, Email)
- [ ] Audit logging to blockchain

---

**Status**: Production-Ready v2.0  
**Last Updated**: 2026-06-03  
**License**: Proprietary
