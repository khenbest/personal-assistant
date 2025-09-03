#!/bin/bash

# Setup script for Ollama models
# Installs the lightweight models needed for intent classification

echo "🚀 Kenny's Personal Assistant - Ollama Setup"
echo "==========================================="
echo ""

# Check if Ollama is installed
if ! command -v ollama &> /dev/null; then
    echo "❌ Ollama is not installed!"
    echo ""
    echo "Please install Ollama first:"
    echo "  brew install ollama"
    echo "  OR"
    echo "  Download from: https://ollama.ai"
    echo ""
    exit 1
fi

echo "✅ Ollama is installed"
echo ""

# Check if Ollama is running
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
    echo "⚠️  Ollama is not running. Starting it now..."
    ollama serve > /dev/null 2>&1 &
    sleep 3
    
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo "❌ Failed to start Ollama. Please run 'ollama serve' manually."
        exit 1
    fi
fi

echo "✅ Ollama is running"
echo ""

# Function to check and pull models
pull_model() {
    local model=$1
    local size=$2
    local description=$3
    
    echo "📦 Checking $model..."
    
    # Check if model exists
    if ollama list | grep -q "$model"; then
        echo "   ✅ $model is already installed"
    else
        echo "   ⬇️  Downloading $model ($size) - $description"
        echo "   This may take a few minutes..."
        
        if ollama pull "$model"; then
            echo "   ✅ $model installed successfully!"
        else
            echo "   ❌ Failed to install $model"
            return 1
        fi
    fi
    echo ""
}

echo "📥 Installing required models..."
echo "================================"
echo ""

# Install primary model - Qwen2.5 1.5B (fastest, smallest)
pull_model "qwen2.5:1.5b" "0.9GB" "Ultra-fast primary model for intent classification"

# Install fallback model - Llama3.2 3B (more capable)
pull_model "llama3.2:3b" "2.0GB" "More capable fallback model"

echo ""
echo "🔥 Warming up models..."
echo "========================"

# Warm up Qwen
echo "Testing qwen2.5:1.5b..."
echo "Hi" | ollama run qwen2.5:1.5b --verbose 2>/dev/null | head -1
echo "✅ qwen2.5:1.5b ready"

# Warm up Llama
echo "Testing llama3.2:3b..."
echo "Hi" | ollama run llama3.2:3b --verbose 2>/dev/null | head -1
echo "✅ llama3.2:3b ready"

echo ""
echo "📊 Model Summary"
echo "================"
ollama list | grep -E "qwen2.5:1.5b|llama3.2:3b"

echo ""
echo "✨ Setup complete!"
echo ""
echo "🎯 Next steps:"
echo "   1. Run the test: npm run test:ollama"
echo "   2. Start the backend: npm run dev"
echo "   3. Test intent classification locally!"
echo ""
echo "💡 Tips:"
echo "   - Qwen2.5:1.5b will handle most requests (<100ms response)"
echo "   - Llama3.2:3b will activate for complex queries"
echo "   - No internet required after setup!"
echo "   - Total disk usage: ~3GB"
echo ""