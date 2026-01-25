#!/bin/bash

# setup_piper.sh - Automates Piper TTS setup on Ubuntu

echo "Starting Galacticord Piper Setup..."

# 1. Pull latest changes and install Node dependencies
echo "[1/4] Updating bot dependencies..."
git pull origin main
npm install

# 2. Install Piper (if not found)
if ! command -v piper &> /dev/null
then
    echo "[2/4] Piper not found. Installing..."
    cd ~
    
    # Download Piper (Linux 64-bit)
    wget -q --show-progress https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
    
    # Extract
    tar -xf piper_linux_x86_64.tar.gz
    
    # Install globally (requires sudo)
    echo "Requesting sudo permissions to move Piper to /usr/local/bin..."
    sudo cp -r piper/* /usr/local/bin/
    sudo ldconfig
    
    # Cleanup
    rm piper_linux_x86_64.tar.gz
    rm -rf piper
    
    echo "Piper installed successfully."
else
    echo "[2/4] Piper is already installed."
fi

# 3. Download Voice Model
echo "[3/4] Downloading 'Amy' Voice Model..."
# Get the absolute path of the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

mkdir -p models

if [ ! -f "models/en_US-amy-medium.onnx" ]; then
    wget -q --show-progress -O models/en_US-amy-medium.onnx "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx?download=true"
    wget -q --show-progress -O models/en_US-amy-medium.onnx.json "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json?download=true"
    echo "Model downloaded to $(pwd)/models/"
else
    echo "Model already exists in $(pwd)/models/"
fi

# Verify file
if [ -f "models/en_US-amy-medium.onnx" ]; then
    echo "Verification: models/en_US-amy-medium.onnx exists."
    ls -lh models/en_US-amy-medium.onnx
else
    echo "ERROR: Model download failed!"
fi

echo "---------------------------------------------------"
echo "[4/4] Setup Complete!"
echo ""
echo "To use this voice, restart your bot:"
echo "  npm start"
echo ""
echo "Then in Discord run:"
echo "  /set mode provider:piper"
echo "  /set voice value:models/en_US-amy-medium.onnx"
echo "---------------------------------------------------"
