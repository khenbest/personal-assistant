# Kenny's Personal AI Assistant

A comprehensive iOS personal assistant with voice interface, calendar management, and intelligent task automation.

## 🧠 FOR CLAUDE: MANDATORY STARTUP SEQUENCE
**If you're Claude/AI reading this:**
1. **FIRST**: Read `.claude/START_HERE.md` 
2. **PARADIGMS**: Read `documentation/paradigms/prompt.md` (workflow instructions)
3. **CONTEXT**: Check `.claude-context/CURRENT_SESSION.md`
4. **UPDATE**: When given a task, immediately run `npm run context task "..."`

**NO EXCEPTIONS. NO BULLSHIT. Follow the paradigms.**

## 🎯 Features

- **Voice Interface**: WhisperKit for on-device speech recognition, AVSpeechSynthesizer for TTS
- **Calendar Integration**: Native iOS calendar and reminders
- **Email Management**: Smart inbox organization and response drafting
- **Task Management**: Intelligent task tracking and prioritization
- **Learning System**: Personalized recommendations based on usage patterns
- **Workflow Automation**: Cross-service task automation
- **Privacy-First**: On-device processing where possible

## 🏗️ Architecture

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   iOS App    │────▶│   Backend    │────▶│   Services   │
│ React Native │     │   Fastify    │     │   Supabase   │
│  WhisperKit  │     │  LangChain   │     │     LLM      │
└──────────────┘     └──────────────┘     └──────────────┘
```

## 📦 Project Structure

```
kenny-assistant/
├── packages/
│   ├── backend/        # Fastify API server
│   ├── mobile/         # React Native Expo app
│   ├── cli/           # CLI testing client
│   └── shared/        # Shared types and utilities
├── documentation/     # Architecture and planning docs
├── scripts/          # Development scripts
└── .github/          # CI/CD workflows
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- iOS development environment (Xcode for device testing)
- Supabase account (free tier)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/personal-assistant.git
cd personal-assistant

# Run setup script
./scripts/setup.sh

# Or manual setup:
npm install
npm run build --workspace=@kenny-assistant/shared
```

### Configuration

1. **Set up Supabase**:
```bash
npx supabase init
npx supabase start
```

2. **Update environment variables**:
```bash
# packages/backend/.env
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
LLM_SERVICE_URL=your_llm_service_url
```

### Development

```bash
# Start all services in development mode
npm run dev

# Or start individually:
npm run dev --workspace=@kenny-assistant/backend  # Backend API
npm run dev --workspace=@kenny-assistant/mobile   # Mobile app
npm run dev --workspace=@kenny-assistant/cli      # CLI client
```

### Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit         # Unit tests
npm run test:integration  # Integration tests
npm run test:e2e         # End-to-end tests

# Test with CLI
npx kenny-cli test --api http://localhost:3000
```

## 🧪 CLI Usage

The CLI provides a quick way to test the assistant functionality:

```bash
# Schedule an event
kenny-cli schedule "Meeting with John tomorrow at 3pm"

# Query the assistant
kenny-cli query "What's on my calendar today?"

# Run integration tests
kenny-cli test --coverage
```

## 📱 Mobile Development

### iOS Simulator

```bash
# Start Expo
cd packages/mobile
npm run ios
```

### Physical Device

```bash
# Build for device
npx eas build --platform ios --profile development

# Or use Expo Go app
npx expo start
# Scan QR code with Expo Go
```

## 🔧 Backend API

The backend provides RESTful endpoints for all assistant functionality:

- `POST /api/command` - Process natural language commands
- `GET /api/calendar/events` - Retrieve calendar events
- `POST /api/calendar/events` - Create calendar event
- `GET /api/memory/context` - Get conversation context
- `POST /api/tasks` - Create task
- `GET /api/health` - Health check

API documentation available at `http://localhost:3000/docs` when running in development.

## 🧠 LLM Integration

The assistant supports multiple LLM providers:

1. **Your existing round-robin service** (recommended)
2. **Ollama** for local LLM (free, private)
3. **OpenAI API** (fallback)

Configure in `packages/backend/.env`:
```
LLM_SERVICE_URL=http://localhost:8080
```

## 📊 Cost Optimization

Monthly costs: **$0-25** (vs $150-200 for traditional stack)

- **WhisperKit**: FREE (on-device)
- **AVSpeechSynthesizer**: FREE (iOS native)
- **Supabase**: FREE tier (500MB database)
- **Ollama**: FREE (local LLM)
- **Hosting**: Render.com FREE tier (750 hours/month)

## 🔒 Security & Privacy

- On-device speech processing with WhisperKit
- Local LLM option with Ollama
- End-to-end encryption for sensitive data
- Row-level security in Supabase
- No data leaves device unless explicitly required

## 📈 Performance Targets

- **Voice Response**: <2s latency
- **Command Processing**: <1s
- **API Response**: <200ms
- **App Launch**: <3s
- **Memory Usage**: <100MB mobile

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## 📄 License

MIT - See [LICENSE](LICENSE) for details.

## 📚 Documentation

- [Architecture Decisions](documentation/ARCHITECTURE-DECISIONS.md)
- [Technical Stack](documentation/TECH-STACK-OPTIMIZED.md)
- [Development Roadmap](documentation/ROADMAP-OPTIMIZED.md)
- [Tool Selection Rationale](documentation/TOOL-SELECTION-RATIONALE.md)

## 🆘 Support

- GitHub Issues: [Report bugs or request features](https://github.com/yourusername/personal-assistant/issues)
- Documentation: Check `/documentation` folder
- CLI Help: `kenny-cli --help`