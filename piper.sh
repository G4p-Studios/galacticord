#!/bin/bash

# piper.sh - Automates Piper TTS setup on Ubuntu

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

# 3. Download Voice Models
echo "[3/4] Downloading English (US) Voice Models..."
# Get the absolute path of the script's directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"

mkdir -p models

# List of English (US) voices to download
# You can add more from: https://huggingface.co/rhasspy/piper-voices/tree/main/en/en_US
VOICES=(
    "en_US-amy-medium"
    "en_US-kathleen-low"
    "en_US-lessac-medium"
    "en_US-libritts-high"
    "en_US-ryan-medium"
    "en_US-joe-medium"
)

for voice in "${VOICES[@]}"; do
    if [ ! -f "models/${voice}.onnx" ]; then
        echo "Downloading ${voice}..."
        # Extract the base name (e.g., amy) and quality (e.g., medium) for the URL
        # URL structure: https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
        
        # This is a bit complex to automate for ALL voices because of the folder structure, 
        # so we will use the direct links for the most popular US voices:
        
        case $voice in
            "en_US-amy-medium") URL_BASE="en/en_US/amy/medium" ;;
            "en_US-kathleen-low") URL_BASE="en/en_US/kathleen/low" ;;
            "en_US-lessac-medium") URL_BASE="en/en_US/lessac/medium" ;;
            "en_US-libritts-high") URL_BASE="en/en_US/libritts/high" ;;
            "en_US-ryan-medium") URL_BASE="en/en_US/ryan/medium" ;;
            "en_US-joe-medium") URL_BASE="en/en_US/joe/medium" ;;
        esac

        wget -q --show-progress -O "models/${voice}.onnx" "https://huggingface.co/rhasspy/piper-voices/resolve/main/${URL_BASE}/${voice}.onnx?download=true"
        wget -q --show-progress -O "models/${voice}.onnx.json" "https://huggingface.co/rhasspy/piper-voices/resolve/main/${URL_BASE}/${voice}.onnx.json?download=true"
    else
        echo "Voice ${voice} already exists."
    fi
done

echo "---------------------------------------------------"
echo "[4/4] Setup Complete!"
echo ""
echo "To use a voice, restart your bot and use:"
echo "  /set mode provider:piper"
echo "  /set voice value:models/en_US-ryan-medium.onnx (or any other model)"
echo "---------------------------------------------------"
