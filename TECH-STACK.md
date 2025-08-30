# Kenny's Personal AI Assistant - Technical Stack

## Architecture Overview
Three-tier architecture with React Native Expo frontend, Node.js/Fastify backend, and distributed intelligence layer leveraging existing LLM orchestration.

## Frontend Layer

### Mobile Application
- Framework: React Native with Expo SDK 50
- Development: Expo Development Build (no local Xcode required)
- Build Service: EAS Build for cloud compilation
- Navigation: Expo Router (file-based routing)
- State Management: Zustand for global state
- UI Components: NativeWind (Tailwind for React Native)
- Voice: expo-speech for TTS, expo-av for audio recording

### iOS Integration
- Siri Integration: App Intents framework via Expo modules
- Shortcuts: Deep linking with URL schemes
- Notifications: expo-notifications for local/push
- Background Tasks: expo-task-manager
- Secure Storage: expo-secure-store for sensitive data

## Backend Layer

### API Server
- Framework: Fastify 4.x (high performance Node.js)
- Language: TypeScript 5.x
- API Style: RESTful with OpenAPI documentation
- Real-time: WebSockets via fastify-websocket
- Authentication: JWT with refresh tokens
- Rate Limiting: @fastify/rate-limit

### Existing Services Integration
- LLM Service: Unified LLM Service from claude-code-trial
  - Round-robin multi-provider support
  - Complexity-based routing
  - Built-in caching and rate limiting
- Conversation Service: Existing conversation-persistence.ts
  - Session management
  - Context tracking
  - Usage analytics

## Intelligence Layer

### Memory System (Three-Tier)

#### Short-Term Memory
- Technology: Upstash Redis (serverless)
- Purpose: Active session state, current context
- TTL: 24 hours
- Data: Current tasks, active conversation, temporary preferences

#### Episodic Memory
- Technology: PostgreSQL with JSONB (Supabase)
- Purpose: Conversation history, interaction patterns
- Retention: 30-90 days rolling window
- Schema:
  ```sql
  conversations (id, user_id, context_jsonb, created_at)
  interactions (id, conversation_id, type, data_jsonb, timestamp)
  patterns (id, user_id, pattern_type, frequency, last_seen)
  ```

#### Semantic Memory
- Technology: Supabase with pgvector extension
- Purpose: Long-term learning, preference modeling
- Retention: Permanent with periodic optimization
- Components:
  - Embeddings: OpenAI text-embedding-ada-002
  - Vector similarity search for context retrieval
  - Knowledge graph for relationship mapping

### AI Orchestration

#### LLM Orchestration
- Primary: LangChain.js for complex chains
- Agents: ReAct pattern for multi-step reasoning
- Memory: ConversationSummaryBufferMemory
- Tools: Custom tools for each service integration

#### Model Providers (from existing unified-llm-service)
- Anthropic Claude (complex reasoning)
- Google Gemini (free tier, general tasks)
- OpenRouter (fallback)
- Together AI (high-volume operations)

#### Specialized AI Services
- Whisper (via WhisperKit): On-device speech-to-text
- ElevenLabs: High-quality text-to-speech
- OpenAI Embeddings: Semantic search and memory

## Integration Layer

### External Services

#### Email
- Service: Gmail API v1
- Auth: OAuth 2.0 with refresh tokens
- Libraries: googleapis npm package
- Capabilities: Read, send, search, labels

#### Calendar
- Primary: Google Calendar API v3
- Secondary: CalDAV for iCloud Calendar
- Libraries: googleapis, tsdav for CalDAV
- Sync: Bidirectional with conflict resolution

#### Task Management
- Internal: PostgreSQL with hierarchical structure
- External: Integration with iOS Reminders via Shortcuts
- Schema: Recursive CTE for subtasks

#### Notes
- Primary: Internal markdown storage
- Integration: Obsidian via Local REST API plugin
- Sync: Periodic export to Obsidian vault
- Format: CommonMark with frontmatter

#### Automation
- Framework: n8n (self-hosted or cloud)
- Integration: Webhook triggers from assistant
- Workflows: JSON-based workflow definitions
- Custom Nodes: Assistant-specific operations

### Knowledge Management

#### Mem0 Integration
- Purpose: Specialized memory management
- Features: Auto-summarization, entity extraction
- Integration: REST API or SDK
- Use Case: Complex memory operations

#### LangChain Integration
- Components:
  - Document loaders for file processing
  - Text splitters for chunking
  - Vector stores for retrieval
  - Chains for complex reasoning
  - Agents for autonomous operations

## Data Layer

### Primary Database
- Service: Supabase (PostgreSQL as a Service)
- Features: Real-time subscriptions, Row Level Security
- Extensions: pgvector for embeddings, pg_cron for scheduling

### Caching
- L1 Cache: In-memory (Node.js)
- L2 Cache: Upstash Redis
- Strategy: Cache-aside with TTL

### File Storage
- Service: Supabase Storage
- Structure: User-scoped buckets
- Types: Documents, audio recordings, exports

## DevOps & Infrastructure

### Deployment
- Frontend: EAS Build → TestFlight/App Store
- Backend: Docker containers on Railway.app
- Database: Supabase cloud
- Automation: n8n cloud or self-hosted

### Monitoring
- APM: Sentry for error tracking
- Logs: Axiom for centralized logging
- Metrics: Prometheus + Grafana
- Uptime: BetterUptime for availability

### CI/CD
- Version Control: GitHub
- CI: GitHub Actions
- Build: EAS Build for mobile
- Deploy: Railway for backend, Supabase migrations

## Security

### Authentication
- Method: JWT with refresh tokens
- MFA: TOTP via authenticator apps
- Biometric: Face ID/Touch ID via expo-local-authentication

### Encryption
- Transit: TLS 1.3 minimum
- At Rest: AES-256 for sensitive data
- Keys: Managed via environment variables

### Compliance
- GDPR: Data portability, right to deletion
- CCPA: Privacy policy, data disclosure
- HIPAA: Not applicable (no health data)

## Development Tools

### Code Quality
- Linting: ESLint with TypeScript rules
- Formatting: Prettier
- Type Checking: TypeScript strict mode
- Testing: Jest + React Native Testing Library

### Development Environment
- IDE: VS Code with React Native tools
- Debugging: Flipper for React Native
- API Testing: Insomnia/Postman
- Database: Supabase Studio

## Performance Targets
- API Response: p50 < 200ms, p99 < 1s
- App Launch: Cold start < 3s
- Memory Usage: < 200MB active
- Battery Impact: < 5% daily usage
- Offline Capability: Core features available

## Scaling Considerations
- Horizontal scaling for API servers
- Read replicas for database
- CDN for static assets
- Queue system for heavy operations (BullMQ)
- Rate limiting per user tier