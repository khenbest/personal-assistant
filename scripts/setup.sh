#!/bin/bash

# Kenny's Personal AI Assistant - Initial Setup Script

set -e

echo "🚀 Setting up Kenny's Personal AI Assistant..."

# Check Node.js version
required_node_version=18
current_node_version=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)

if [ "$current_node_version" -lt "$required_node_version" ]; then
    echo "❌ Node.js version $required_node_version or higher is required. Current version: $current_node_version"
    exit 1
fi

echo "✅ Node.js version check passed"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build shared package first
echo "🔨 Building shared package..."
npm run build --workspace=@kenny-assistant/shared

# Setup git hooks
echo "🪝 Setting up git hooks..."
npx husky install

# Create .env files if they don't exist
if [ ! -f packages/backend/.env ]; then
    echo "📝 Creating backend .env file..."
    cat > packages/backend/.env << EOL
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
CORS_ORIGIN=http://localhost:8081

# Add these after setting up Supabase
# SUPABASE_URL=your_supabase_url
# SUPABASE_ANON_KEY=your_supabase_anon_key

# Add this after setting up your LLM service
# LLM_SERVICE_URL=http://localhost:8080
EOL
fi

if [ ! -f packages/mobile/.env ]; then
    echo "📝 Creating mobile .env file..."
    cat > packages/mobile/.env << EOL
API_URL=http://localhost:3000
EOL
fi

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "⚠️  Supabase CLI not found. Installing..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install supabase/tap/supabase
    else
        echo "Please install Supabase CLI: https://supabase.com/docs/guides/cli"
    fi
fi

# Create required directories
echo "📁 Creating required directories..."
mkdir -p logs
mkdir -p data
mkdir -p .vscode

# Create VS Code settings
echo "⚙️ Creating VS Code settings..."
cat > .vscode/settings.json << EOL
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/build": true,
    "**/coverage": true
  }
}
EOL

echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Set up Supabase project: npx supabase init"
echo "2. Update .env files with your API keys"
echo "3. Start development: npm run dev"
echo "4. Run tests: npm test"
echo ""
echo "📚 Documentation available in /documentation folder"