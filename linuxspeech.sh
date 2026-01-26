#!/bin/bash

# linuxspeech.sh - Installs espeak-ng and RHVoice engines on Ubuntu

echo "Starting TTS Engine Setup (espeak-ng & RHVoice)..."

# Update package lists
echo "[1/2] Updating package lists..."
sudo apt-get update

# Install espeak-ng
echo "[2/2] Installing espeak-ng..."
if ! command -v espeak-ng &> /dev/null
then
    sudo apt-get install -y espeak-ng
    echo "espeak-ng installed successfully."
else
    echo "espeak-ng is already installed."
fi

# Install RHVoice
echo "[3/3] Installing RHVoice..."
if ! command -v RHVoice-test &> /dev/null
then
    # Install the engine and common voice packs
    sudo apt-get install -y rhvoice rhvoice-english rhvoice-russian
    echo "RHVoice installed successfully."
else
    echo "RHVoice is already installed."
fi

echo "---------------------------------------------------"
echo "Setup Complete!"
echo ""
echo "You can now use these in Discord:"
echo "  /set mode provider:espeak"
echo "  /set mode provider:rhvoice"
echo "---------------------------------------------------"
