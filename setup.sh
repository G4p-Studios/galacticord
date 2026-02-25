#!/bin/bash

# Galacticord Management & Setup Script
# Designed for accessibility and ease of use on Linux/VPS.

echo "===================================================="
echo "    GALACTICORD DISCORD BOT - MANAGEMENT SCRIPT    "
echo "===================================================="
echo "1) Install / Setup (Fresh Install & .env config)"
echo "2) Start Bot (Standard npm start)"
echo "3) Create Systemd Service (Auto-restart on boot)"
echo "4) Exit"
echo "===================================================="
read -p "Select an option [1-4]: " choice

case $choice in
  1)
    echo ""
    echo "[Step 1/5] Checking environment and installing system dependencies..."
    
    # Check for sudo
    if [ "$EUID" -ne 0 ]; then 
        echo "Please run as root or with sudo if you want to install system packages."
        SUDO="sudo"
    else
        SUDO=""
    fi

    # Install system packages (Debian/Ubuntu focused)
    if command -v apt-get &> /dev/null; then
        echo "Installing espeak-ng, ffmpeg, curl, and wget..."
        $SUDO apt-get update -y
        $SUDO apt-get install -y espeak-ng ffmpeg curl wget git
    else
        echo "Non-Debian/Ubuntu system detected. Please ensure espeak-ng, ffmpeg, and curl are installed manually."
    fi

    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed. Please install Node.js (v18+) first."
        exit 1
    fi

    # If the current directory is empty or not a git repo, offer to clone
    if [ ! -d ".git" ]; then
        echo "Current directory is not a Galacticord repository."
        read -p "Would you like to clone Galacticord here? [y/n]: " clone_choice
        if [[ "$clone_choice" =~ ^[Yy]$ ]]; then
            git clone https://github.com/G4p-Studios/galacticord.git .
        fi
    fi

    echo ""
    echo "[Step 2/5] Installing npm dependencies..."
    npm install

    echo ""
    echo "[Step 3/5] Setting up Piper voices..."
    mkdir -p models
    if [ ! -f "models/en_US-amy-medium.onnx" ]; then
        echo "Downloading default Piper voice (Amy Medium)..."
        wget -O models/en_US-amy-medium.onnx https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx
        wget -O models/en_US-amy-medium.onnx.json https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/amy/medium/en_US-amy-medium.onnx.json
    else
        echo "Default Piper voice already exists."
    fi

    echo ""
    echo "[Step 4/5] Configuring .env file..."
    echo "Please enter your credentials below. Leave blank to skip optional ones."
    
    read -p "Discord Bot Token (Required): " DISCORD_TOKEN
    read -p "Discord Client ID (Required): " CLIENT_ID
    read -p "Gemini API Key (Optional, for AI features): " GEMINI_API_KEY
    read -p "Google Cloud API Key (Optional, for High Quality TTS): " GOOGLE_CLOUD_API_KEY
    read -p "YouTube API Key (Optional, for Music Search): " YOUTUBE_API_KEY
    read -p "Bot Owner ID (Optional): " OWNER_ID

    cat <<EOF > .env
DISCORD_TOKEN=$DISCORD_TOKEN
CLIENT_ID=$CLIENT_ID
GEMINI_API_KEY=$GEMINI_API_KEY
GOOGLE_CLOUD_API_KEY=$GOOGLE_CLOUD_API_KEY
YOUTUBE_API_KEY=$YOUTUBE_API_KEY
OWNER_ID=$OWNER_ID
EOF

    echo ""
    echo "[Step 5/5] Finalizing setup..."
    # Make other scripts executable if they exist
    chmod +x *.sh 2>/dev/null

    echo ""
    echo "SUCCESS: Galacticord is installed and configured."
    echo "You can now start the bot using option 2 or create a service with option 3."
    ;;

  2)
    echo "Starting Galacticord..."
    npm start
    ;;

  3)
    echo ""
    echo "SYSTEMD SERVICE CREATION"
    echo "This will allow your bot to run in the background and start on boot."
    
    read -p "Enter service name [galacticord]: " SERVICE_NAME
    SERVICE_NAME=${SERVICE_NAME:-galacticord}
    
    CUR_DIR=$(pwd)
    CUR_USER=$(whoami)
    NODE_PATH=$(command -v node)

    if [ -z "$NODE_PATH" ]; then
        echo "Error: Could not find node path."
        exit 1
    fi

    echo "Generating service file for $SERVICE_NAME..."
    
    cat <<EOF | sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null
[Unit]
Description=Galacticord Discord Bot ($SERVICE_NAME)
After=network.target

[Service]
Type=simple
User=$CUR_USER
WorkingDirectory=$CUR_DIR
ExecStart=$NODE_PATH index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

    echo "Reloading systemd and enabling service..."
    sudo systemctl daemon-reload
    sudo systemctl enable ${SERVICE_NAME}.service
    
    echo ""
    echo "SUCCESS: Service '${SERVICE_NAME}' created and enabled."
    echo "To start the bot now, run: sudo systemctl start ${SERVICE_NAME}"
    echo "To view logs, run: journalctl -u ${SERVICE_NAME} -f"
    ;;

  4)
    echo "Exiting."
    exit 0
    ;;

  *)
    echo "Invalid option. Exiting."
    exit 1
    ;;
esac
