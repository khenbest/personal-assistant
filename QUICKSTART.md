# 🚀 Quick Start Guide

## Prerequisites

- Node.js 18+ and npm 9+
- Supabase account (free tier)
- Your claude-code-trial service running (optional but recommended)

## 1. Initial Setup (5 minutes)

```bash
# Run the setup script
./scripts/setup.sh

# Or manually:
npm install
```

## 2. Configure Services

### Supabase Setup

1. Go to your Supabase project: https://supabase.com/dashboard/project/epfclgvooboffhlxccmb
2. Get your `anon` key from Settings → API
3. Update `packages/backend/.env`:

```env
SUPABASE_URL=https://epfclgvooboffhlxccmb.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
```

4. Run the database migration:
```bash
# Option 1: Via Supabase Dashboard
# Go to SQL Editor and paste contents of supabase/migrations/001_initial_schema.sql

# Option 2: Via CLI (if you have Supabase CLI)
supabase db push
```

### LLM Service Setup

Start your claude-code-trial service:
```bash
cd /Users/kenny/repos/claude-code-trial
npm run dev
```

Or update `packages/backend/.env` to use mock responses:
```env
# Comment this out to use mock responses
# LLM_SERVICE_URL=http://localhost:8000
```

## 3. Start Development Servers

### Terminal 1: Backend API
```bash
cd packages/backend
npm run dev
# API will be available at http://localhost:3000
```

### Terminal 2: Mobile App (Expo)
```bash
cd packages/mobile
npm start
# Press 'i' for iOS simulator
# Or scan QR code with Expo Go app
```

### Terminal 3: Test with CLI
```bash
cd packages/cli
npm run dev schedule "Meeting with John tomorrow at 3pm"
npm run dev query "What's on my calendar?"
npm run dev test
```

## 4. Test the System

### Using the CLI
```bash
# Schedule an event
kenny-cli schedule "Dentist appointment next Tuesday at 2pm"

# Query the assistant
kenny-cli query "What do I have scheduled this week?"

# Run integration tests
kenny-cli test --api http://localhost:3000
```

### Using the Mobile App
1. Open the app in iOS simulator or Expo Go
2. Type or speak: "Schedule lunch with Sarah tomorrow at noon"
3. Check the Calendar tab to see your events
4. Try the Tasks tab for todo management

## 5. Common Issues & Solutions

### Backend won't start
- Check if port 3000 is already in use
- Verify Node.js version: `node --version` (should be 18+)

### Supabase connection fails
- Verify your anon key is correct
- Check if the database migrations ran successfully
- The app will work with mock data if Supabase isn't configured

### LLM service not responding
- The app will use mock responses if claude-code-trial isn't running
- To use real LLM, ensure claude-code-trial is running on port 8000

### Mobile app can't connect to backend
- If using a physical device, update `API_URL` in `packages/mobile/.env` to your computer's IP address
- Example: `API_URL=http://192.168.1.100:3000`

## 6. Next Steps

### Enable Voice (WhisperKit)
```bash
# Coming soon - WhisperKit integration
# For now, the app uses Expo's speech recognition
```

### Deploy to Production
```bash
# Build for production
npm run build

# Deploy backend to Render.com
# Follow instructions in README.md
```

### Add Siri Shortcuts
1. Build the iOS app with EAS Build
2. Add Siri Shortcuts in the Settings screen
3. Use "Hey Siri, ask Kenny to schedule a meeting"

## 📱 Features Available Now

✅ Natural language command processing
✅ Calendar event creation (mock or Supabase)
✅ Task management
✅ Voice output (TTS)
✅ CLI testing interface
✅ Mobile app with chat interface
✅ Integration with your LLM service

## 🚧 Coming Soon

- WhisperKit voice input
- iOS Calendar integration
- Siri Shortcuts
- Email management
- Learning system
- Ollama local LLM support

---

Need help? Check the [README](README.md) or the [documentation](documentation/) folder.