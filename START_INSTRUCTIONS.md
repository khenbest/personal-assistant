# 🚀 How to Start Your Personal Assistant App

## Quick Start (All-in-One)

Open a terminal and run:
```bash
cd /Users/kenny/repos/personal-assistant
./start-all.sh
```

## Manual Start (Two Terminals)

### Terminal 1: Backend API
```bash
cd /Users/kenny/repos/personal-assistant/packages/backend
npm run dev
```

Wait for: `🚀 Server running at http://0.0.0.0:3000`

### Terminal 2: Mobile App (Expo)
```bash
cd /Users/kenny/repos/personal-assistant/packages/mobile
npm start
```

This will show:
- QR code for scanning with Expo Go app
- Press `i` to open iOS Simulator
- Press `w` to open in web browser
- Press `a` to open Android emulator

## Testing the App

### Option 1: iOS Simulator
1. In the Expo terminal, press `i`
2. iOS Simulator will launch with your app

### Option 2: Physical iPhone
1. Install "Expo Go" from App Store
2. Scan the QR code with your camera
3. Tap the notification to open in Expo Go

### Option 3: Web Browser
1. In the Expo terminal, press `w`
2. Opens at http://localhost:8081

## Verify Everything is Working

### Check Backend:
```bash
curl http://localhost:3000/health
```
Should return: `{"status":"ok","timestamp":"..."}`

### Check Mobile:
- Open http://localhost:8081 in browser
- Should see Expo Dev Tools

## Troubleshooting

### If port 3000 is already in use:
```bash
lsof -i :3000
kill -9 <PID>
```

### If Expo won't start:
```bash
npx expo start --clear
```

### If iOS Simulator won't open:
```bash
npx expo run:ios
```

## Stop Everything

Press `Ctrl+C` in both terminals to stop the services.