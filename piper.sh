#!/bin/bash

# piper.sh - Automates Piper TTS setup on Ubuntu

echo "Starting Galacticord Piper Setup..."

# 1. Update bot dependencies
echo "[1/4] Updating bot dependencies..."
git pull origin main
npm install

# 2. Install Piper (if not found)
if ! command -v piper &> /dev/null
then
    echo "[2/4] Piper not found. Installing..."
    cd ~
    wget -q --show-progress https://github.com/rhasspy/piper/releases/download/2023.11.14-2/piper_linux_x86_64.tar.gz
    tar -xf piper_linux_x86_64.tar.gz
    sudo cp -r piper/* /usr/local/bin/
    sudo ldconfig
    rm piper_linux_x86_64.tar.gz
    rm -rf piper
    echo "Piper installed successfully."
else
    echo "[2/4] Piper is already installed."
fi

# 3. Download Voice Models
echo "[3/4] Downloading Voice Models..."
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
cd "$SCRIPT_DIR"
mkdir -p models

# US Voices
VOICES=(
    "en_US-amy-medium"
    "en_US-kathleen-low"
    "en_US-lessac-medium"
    "en_US-libritts-high"
    "en_US-ryan-medium"
    "en_US-joe-medium"
)

# Retro Voices
RETRO_VOICES=(
    "retro-vocal-tract"
    "retro-klatt"
    "retro-speakjet"
    "retro-sam"
    "retro-dec-talk"
)

download_voice() {
    local name=$1
    local url_onnx=$2
    local url_json=$3

    # SELF-HEALING: If file exists but is 0 bytes (corrupt), remove it
    if [ -f "models/${name}.onnx" ] && [ ! -s "models/${name}.onnx" ]; then
        echo "Detected corrupted model ${name}. Cleaning up..."
        rm "models/${name}.onnx" "models/${name}.onnx.json" 2>/dev/null
    fi

    if [ ! -f "models/${name}.onnx" ]; then
        echo "Downloading ${name}..."
        wget -q --show-progress -O "models/${name}.onnx" "$url_onnx"
        wget -q --show-progress -O "models/${name}.onnx.json" "$url_json"
    else
        echo "Voice ${name} already exists."
    fi
}

# Process US Voices
for voice in "${VOICES[@]}"; do
    case $voice in
        "en_US-amy-medium") B="en/en_US/amy/medium" ;; 
        "en_US-kathleen-low") B="en/en_US/kathleen/low" ;; 
        "en_US-lessac-medium") B="en/en_US/lessac/medium" ;; 
        "en_US-libritts-high") B="en/en_US/libritts/high" ;; 
        "en_US-ryan-medium") B="en/en_US/ryan/medium" ;; 
        "en_US-joe-medium") B="en/en_US/joe/medium" ;; 
    esac
    download_voice "$voice" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/${B}/${voice}.onnx?download=true" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/${B}/${voice}.onnx.json?download=true"
done

# Process Retro Voices
for voice in "${RETRO_VOICES[@]}"; do
    download_voice "$voice" \
        "https://huggingface.co/eurpod/retro-speech-synthesizers/resolve/main/${voice}.onnx?download=true" \
        "https://huggingface.co/eurpod/retro-speech-synthesizers/resolve/main/${voice}.onnx.json?download=true"
done

echo "---------------------------------------------------"
echo "[4/4] Setup Complete!"
echo "---------------------------------------------------"