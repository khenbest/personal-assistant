# Architecture Decision Records (ADRs)

## ADR-001: Cost-First Architecture Strategy
**Date**: 2024-12-30
**Status**: Accepted

### Context
Original architecture would cost $150-200/month with multiple paid services (Redis, n8n, Mem0, ElevenLabs, monitoring services).

### Decision
Adopt a "Free-First" strategy where every paid service must justify its cost against free alternatives by being superior in multiple critical dimensions.

### Consequences
- ✅ Reduced monthly cost from $150-200 to $0-25
- ✅ Simplified architecture with fewer services to manage
- ⚠️ Some features may require more development effort
- ⚠️ May need to migrate services as we scale

---

## ADR-002: Unified Database Strategy (PostgreSQL for Everything)
**Date**: 2024-12-30
**Status**: Accepted

### Context
Original design used three separate systems for memory:
- Upstash Redis for short-term ($10/mo)
- PostgreSQL for episodic
- pgvector for semantic

### Decision
Use PostgreSQL (via Supabase) for all three memory tiers:
- Short-term: JSONB with TTL via pg_cron
- Episodic: Standard tables with indexes
- Semantic: pgvector extension

### Consequences
- ✅ Single service to manage, backup, and monitor
- ✅ Save $10/month on Redis
- ✅ Atomic transactions across all memory tiers
- ⚠️ Slightly higher latency for cache operations (negligible at our scale)

---

## ADR-003: On-Device Voice Processing with WhisperKit
**Date**: 2024-12-30
**Status**: Accepted

### Context
Voice processing options:
- Cloud APIs (Whisper API, Google Speech) - privacy concerns, costs
- On-device processing - free, private, but requires optimization

### Decision
Use WhisperKit for on-device speech-to-text processing.

### Rationale
- **Performance**: 0.46s latency, 2.2% WER
- **Privacy**: Nothing leaves the device
- **Cost**: Completely free vs $0.006/minute
- **Real-time**: Streaming support for conversational UX

### Consequences
- ✅ Zero cost for voice processing
- ✅ Complete privacy preservation
- ✅ Works offline
- ⚠️ Requires iOS 16.6+ and newer devices
- ⚠️ Initial model download (~200MB)

---

## ADR-004: Hybrid LLM Strategy (Ollama + Cloud)
**Date**: 2024-12-30
**Status**: Accepted

### Context
LLM costs can quickly escalate with cloud-only approach, but local-only limits capabilities.

### Decision
Implement hybrid approach:
```typescript
simple_queries → Ollama (local, FREE)
complex_reasoning → Existing round-robin service
offline_mode → Ollama fallback
embeddings → Local Xenova/transformers
```

### Consequences
- ✅ 80-90% of queries handled for free
- ✅ Maintains capability for complex queries
- ✅ Works offline with degraded functionality
- ⚠️ Requires local Ollama server setup
- ⚠️ Need to classify query complexity

---

## ADR-005: React Native Expo Over Native iOS
**Date**: 2024-12-30
**Status**: Accepted

### Context
Choice between native iOS development (Swift/SwiftUI) vs cross-platform (React Native).

### Decision
Use React Native with Expo for iOS development.

### Rationale
- **No Mac Required**: Can develop on any platform
- **OTA Updates**: Push fixes without App Store review
- **Ecosystem**: Massive package ecosystem
- **Team Skills**: JavaScript/TypeScript more common
- **Future Android**: Leaves door open for Android

### Consequences
- ✅ Faster development with hot reload
- ✅ Easier to find developers
- ✅ Free cloud builds with EAS
- ⚠️ Slightly larger app size
- ⚠️ Some native features require modules

---

## ADR-006: iOS-First Calendar Integration
**Date**: 2024-12-30
**Status**: Accepted

### Context
Users primarily use iOS Calendar (iCloud), not Google Calendar.

### Decision
- Primary: iOS Calendar via CalDAV protocol
- Secondary: Google Calendar API for users who need it

### Consequences
- ✅ Native iOS experience
- ✅ Works with existing user calendars
- ✅ No additional sign-ins required
- ⚠️ CalDAV complexity vs REST APIs

---

## ADR-007: LangChain.js for Orchestration (No n8n)
**Date**: 2024-12-30
**Status**: Accepted

### Context
n8n provides visual workflow builder but costs $20/month or requires self-hosting.

### Decision
Use LangChain.js for all orchestration and automation needs.

### Rationale
- Already needed for conversation management
- Powerful agent system for automation
- No additional service to run
- Code-based workflows easier to version control

### Consequences
- ✅ Save $20/month
- ✅ One less service to manage
- ✅ Better integration with LLM logic
- ⚠️ No visual workflow editor
- ⚠️ Workflows defined in code

---

## ADR-008: Free Hosting with Render.com
**Date**: 2024-12-30
**Status**: Accepted

### Context
Backend hosting options: Railway ($20/mo), Heroku, Render, self-host.

### Decision
Use Render.com free tier (750 hours/month).

### Rationale
- Sufficient for always-on service
- Auto-deploy from GitHub
- Zero configuration needed
- Clear upgrade path when needed

### Consequences
- ✅ $0 hosting cost
- ✅ Automatic deployments
- ⚠️ Cold starts after inactivity
- ⚠️ Need to monitor usage

---

## ADR-009: Native iOS TTS Over ElevenLabs
**Date**: 2024-12-30
**Status**: Accepted

### Context
Text-to-speech options: ElevenLabs ($5-330/mo) vs AVSpeechSynthesizer (free).

### Decision
Use AVSpeechSynthesizer for all TTS needs.

### Rationale
- 60+ voices available
- Completely free
- Offline capable
- Instant playback

### Consequences
- ✅ Save $5+/month
- ✅ No API limits
- ✅ Works offline
- ⚠️ Less natural than ElevenLabs
- ✅ Good enough for personal assistant

---

## ADR-010: Local Embeddings Over OpenAI
**Date**: 2024-12-30
**Status**: Accepted

### Context
OpenAI embeddings cost $0.0001/1k tokens. Local alternatives exist.

### Decision
Use Xenova/transformers for JavaScript-based local embeddings.

### Rationale
- Runs in Node.js backend
- Free vs ~$10/month
- Good enough quality for semantic search
- Privacy preserved

### Consequences
- ✅ Zero embedding costs
- ✅ Data stays private
- ⚠️ Slightly lower quality
- ⚠️ 50MB model size
- ✅ Can upgrade if quality issues

---

## ADR-011: Simplified Monitoring Stack
**Date**: 2024-12-30
**Status**: Accepted

### Context
Original monitoring: Axiom ($25/mo), BetterUptime ($29/mo), Prometheus, Grafana.

### Decision
- Error tracking: Sentry free tier (5k events/month)
- Uptime: UptimeRobot free (50 monitors)
- Logs: Local with rotation
- Metrics: Skip initially, add if needed

### Consequences
- ✅ Save $54/month
- ✅ Sufficient for personal project
- ⚠️ Less sophisticated analytics
- ✅ Can upgrade when needed

---

## ADR-012: Eight-Week MVP Timeline
**Date**: 2024-12-30
**Status**: Accepted

### Context
Original roadmap had 6 batches over 12+ weeks with 122 story points.

### Decision
Simplified 8-week timeline focusing on core features:
- Weeks 1-2: Foundation
- Weeks 3-4: Voice & Intelligence
- Weeks 5-6: iOS Integration
- Week 7: External Services
- Week 8: Polish & Launch

### Consequences
- ✅ Faster time to market
- ✅ Earlier user feedback
- ✅ Reduced complexity
- ⚠️ Some features deferred
- ✅ Iterative improvement post-launch

---

## Future Decisions to Make

### When to Upgrade Services
1. **Supabase Pro**: When >500MB database or >1GB storage
2. **Render Paid**: If uptime critical
3. **ElevenLabs**: If voice quality complaints
4. **OpenAI Embeddings**: If search quality issues
5. **Dedicated Infrastructure**: At 1000+ users

### Deferred Decisions
- Android support (wait for user demand)
- Advanced automation UI (use code for now)
- Multi-user support (single user first)
- Cloud sync across devices (iCloud sufficient)
- Advanced analytics (basic metrics first)

---

## Decision Principles

1. **Free First**: Always prefer free alternatives unless paid is significantly superior
2. **iOS Native**: Prioritize iOS native features over cross-platform
3. **Privacy Default**: On-device processing when possible
4. **Simple Architecture**: Fewer services = less complexity
5. **Progressive Enhancement**: Start simple, add complexity based on real needs
6. **User Value**: Every decision must provide clear user value
7. **Cost Transparency**: Track and optimize costs continuously

---

## Reversal Conditions

Each decision can be reversed if:
- Free alternative proves insufficient for core functionality
- User feedback strongly indicates need for change
- Scaling requires different architecture
- New free alternatives become available
- Cost-benefit analysis changes significantly