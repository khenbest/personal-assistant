# Kenny's Personal AI Assistant - Optimized Technical Stack

## Architecture Overview
Cost-optimized three-tier architecture prioritizing free/open-source solutions while maintaining scalability and performance.

**Monthly Cost Target**: $0-25/month (vs original $150-200/month)

## Frontend Layer

### Mobile Application
- **Framework**: React Native with Expo SDK 50
  - **Cost**: FREE
  - **Why**: No Mac required for development, OTA updates, massive ecosystem
- **Development**: Expo Development Build
  - **Cost**: FREE (30 builds/month free tier)
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand for global state
- **UI Components**: NativeWind (Tailwind for React Native)

### iOS Integration
- **Voice Input**: WhisperKit Live
  - **Cost**: FREE (on-device)
  - **Why**: 0.46s latency, 2.2% WER, privacy-preserving, real-time streaming
- **Voice Output**: AVSpeechSynthesizer
  - **Cost**: FREE (iOS native)
  - **Why**: 60+ voices, offline capable, zero latency
- **Siri Integration**: App Intents framework via Expo modules
- **Notifications**: expo-notifications
- **Background Tasks**: expo-task-manager
- **Secure Storage**: expo-secure-store

## Backend Layer

### API Server
- **Framework**: Fastify 4.x
  - **Cost**: FREE
  - **Why**: Fastest Node.js framework (30k req/sec), TypeScript-first, plugin ecosystem
- **Language**: TypeScript 5.x
- **API Style**: RESTful with OpenAPI documentation
- **Real-time**: WebSockets via fastify-websocket
- **Authentication**: Supabase Auth (JWT with refresh tokens)
  - **Cost**: FREE (part of Supabase free tier)

### Hosting
- **Primary**: Render.com
  - **Cost**: FREE (750 hours/month)
  - **Why**: Auto-deploy from GitHub, zero config, scales when needed
- **Alternative**: Self-hosted on home server for complete cost elimination

## Intelligence Layer

### LLM Strategy (Hybrid Approach)
```typescript
// Cost-optimized routing
const llmRouter = {
  simple_queries: "Ollama (local, FREE)",
  complex_reasoning: "Existing round-robin service",
  high_volume: "Google Gemini (free tier)",
  fallback: "Together AI or OpenRouter"
}
```

### Memory System (Simplified & Free)

#### Short-Term Memory (Active Session)
- **Technology**: PostgreSQL JSONB with TTL
- **Cost**: FREE (uses Supabase existing database)
- **Implementation**:
```sql
CREATE TABLE short_term_memory (
  key TEXT PRIMARY KEY,
  value JSONB,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);
-- Cleanup via pg_cron (free Supabase extension)
```

#### Episodic Memory (Conversation History)
- **Technology**: PostgreSQL with JSONB
- **Cost**: FREE
- **Retention**: 30-90 days rolling window
- **Why**: No need for separate Redis service

#### Semantic Memory (Long-term Learning)
- **Technology**: pgvector + local embeddings
- **Cost**: FREE
- **Embeddings**: Xenova/transformers (JavaScript, runs locally)
  - Saves $0.0001/1k tokens vs OpenAI
- **Implementation**:
```typescript
import { pipeline } from '@xenova/transformers';
const embedder = await pipeline('feature-extraction', 
  'Xenova/all-MiniLM-L6-v2'); // Free, local
```

### AI Orchestration

#### LLM Management
- **Primary**: Your existing unified-llm-service.ts
  - **Why**: Already built, tested, and cost-optimized
- **Orchestration**: LangChain.js
  - **Cost**: FREE
  - **Why**: Handles agents, memory, and automation without n8n
- **Local Models**: Ollama integration
  - **Cost**: FREE when self-hosted
  - **Use**: Simple queries, embeddings, offline mode

#### Speech Processing
- **Speech-to-Text**: WhisperKit (not Whisper API)
  - On-device, real-time, free
- **Text-to-Speech**: AVSpeechSynthesizer (not ElevenLabs)
  - iOS native, 60+ voices, free

## Data Layer

### Primary Database
- **Service**: Supabase
  - **Cost**: FREE tier (500MB database, 1GB storage, 2GB bandwidth)
  - **Upgrade**: $25/month only when exceeding limits
  - **Why**: Integrated auth, real-time, RLS, automatic backups
- **Extensions**: 
  - pgvector (semantic search) - FREE
  - pg_cron (scheduled jobs) - FREE

### Caching Strategy
- **L1 Cache**: In-memory Node.js cache
- **L2 Cache**: PostgreSQL JSONB (not Redis)
  - Eliminates Upstash Redis ($10/month saved)

### File Storage
- **Service**: Supabase Storage
  - **Cost**: FREE (1GB included)
- **Structure**: User-scoped buckets
- **Alternative**: User's iCloud Drive (already paid for)

## Integration Layer

### External Services (All Free)

#### Email
- **Service**: Gmail API v1
- **Cost**: FREE
- **Auth**: OAuth 2.0 with refresh tokens

#### Calendar
- **Primary**: iOS Calendar via CalDAV
  - **Cost**: FREE (user's iCloud)
- **Secondary**: Google Calendar API v3
  - **Cost**: FREE

#### Task Management
- **Internal**: PostgreSQL with recursive CTEs
- **External**: iOS Reminders via Shortcuts
- **Cost**: FREE

#### Notes
- **Primary**: Internal markdown in PostgreSQL
- **Sync**: iCloud Drive for backup
- **Cost**: FREE

#### Automation
- **Framework**: LangChain.js agents (instead of n8n)
  - **Cost**: FREE
  - **Why**: No additional service, already using LangChain

## DevOps & Infrastructure

### Deployment
- **Frontend**: 
  - EAS Build free tier (30 builds/month)
  - TestFlight (FREE)
- **Backend**: 
  - Render.com (FREE tier)
  - Alternative: Self-hosted Docker
- **Database**: Supabase cloud (FREE tier)

### Monitoring (All Free)
- **Error Tracking**: Sentry free tier (5k events/month)
- **Logs**: Local logging with rotation
  - Alternative to Axiom ($25/month saved)
- **Metrics**: Prometheus + Grafana (self-hosted)
  - **Cost**: FREE
- **Uptime**: UptimeRobot (50 free monitors)
  - Alternative to BetterUptime ($29/month saved)

### CI/CD
- **Version Control**: GitHub (FREE)
- **CI**: GitHub Actions (2000 minutes/month FREE)
- **Mobile Build**: EAS Build free tier
- **Backend Deploy**: Render auto-deploy from GitHub

## Security

### Authentication
- **Method**: Supabase Auth (JWT + refresh tokens)
  - **Cost**: FREE
- **MFA**: TOTP via Supabase Auth
- **Biometric**: expo-local-authentication

### Encryption
- **Transit**: TLS 1.3 (Supabase handles)
- **At Rest**: Supabase encryption (FREE)
- **Local**: expo-secure-store for sensitive data

## Development Tools

### Code Quality
- **Linting**: ESLint (FREE)
- **Formatting**: Prettier (FREE)
- **Type Checking**: TypeScript (FREE)
- **Testing**: Jest + React Native Testing Library (FREE)

### Development Environment
- **IDE**: VS Code (FREE)
- **Debugging**: Flipper for React Native (FREE)
- **API Testing**: Insomnia/Postman (FREE)
- **Database**: Supabase Studio (FREE)

## Performance Targets
- API Response: p50 < 200ms, p99 < 1s
- App Launch: Cold start < 3s
- Memory Usage: < 200MB active
- Battery Impact: < 5% daily (WhisperKit optimized)
- Cost: $0-25/month maximum

## Cost Optimization Summary

### Services Eliminated
- ❌ Upstash Redis → PostgreSQL JSONB (save $10/mo)
- ❌ n8n → LangChain.js agents (save $20/mo)
- ❌ Mem0 → Custom PostgreSQL (save $10/mo)
- ❌ Railway → Render.com free tier (save $20/mo)
- ❌ ElevenLabs → AVSpeechSynthesizer (save $5/mo)
- ❌ Axiom → Local logging (save $25/mo)
- ❌ BetterUptime → UptimeRobot (save $29/mo)
- ❌ OpenAI Embeddings → Local Xenova (save ~$10/mo)

### Total Savings: $129+/month

### Scaling Strategy
```yaml
Phase 1 (MVP): 
  cost: $0/month
  users: 1-10
  
Phase 2 (Growth):
  cost: $0-10/month
  users: 10-100
  upgrade: Monitor Supabase limits
  
Phase 3 (Scale):
  cost: $25/month
  users: 100+
  upgrade: Supabase Pro only
```

## Migration Path from Free to Paid

When you hit limits, upgrade in this order:
1. **Supabase Pro** ($25/mo) - When exceeding 500MB database
2. **Render Paid** ($7/mo) - For always-on backend
3. **OpenAI Embeddings** - Only if local embeddings too slow
4. **ElevenLabs** - Only if voice quality critical
5. **Dedicated Hosting** - Only at 1000+ users