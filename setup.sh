#!/bin/bash

# Galacticord Management & Setup Script
# Designed for accessibility and ease of use on Linux/VPS.

echo "===================================================="
echo "    GALACTICORD DISCORD BOT - MANAGEMENT SCRIPT    "
echo "===================================================="
echo "1) Install / Setup (Full Installation & .env config)"
echo "2) Start Bot (Standard npm start)"
echo "3) Create Systemd Service (Auto-restart on boot)"
echo "4) Exit"
echo "===================================================="
read -p "Select an option [1-4]: " choice

case $choice in
  1)
    echo ""
    echo "[Step 1/6] Checking environment and installing system dependencies..."
    
    # Check for sudo
    if [ "$EUID" -ne 0 ]; then 
        echo "Please run as root or with sudo if you want to install system packages."
        SUDO="sudo"
    else
        SUDO=""
    fi

    # Install system packages (Debian/Ubuntu focused)
    if command -v apt-get &> /dev/null; then
        echo "Installing core dependencies: ffmpeg, curl, wget, git, libsodium-dev..."
        $SUDO apt-get update -y
        $SUDO apt-get install -y ffmpeg curl wget git libsodium-dev
    else
        echo "Non-Debian/Ubuntu system detected. Please ensure ffmpeg, curl, and wget are installed manually."
    fi

    if ! command -v node &> /dev/null; then
        echo "Error: Node.js is not installed. Please install Node.js (v18+) first."
        exit 1
    fi

    # If the current directory is not a git repo, offer to clone
    if [ ! -d ".git" ]; then
        echo "Current directory is not a Galacticord repository."
        read -p "Would you like to clone Galacticord here? [y/n]: " clone_choice
        if [[ "$clone_choice" =~ ^[Yy]$ ]]; then
            git clone https://github.com/G4p-Studios/galacticord.git .
        fi
    fi

    echo ""
    echo "[Step 2/6] Running npm install..."
    npm install

    echo ""
    echo "[Step 3/6] Setting up local TTS engines (Piper, Linux voices)..."
    if [ -f "./piper.sh" ]; then
        chmod +x piper.sh
        ./piper.sh
    fi
    if [ -f "./linuxspeech.sh" ]; then
        chmod +x linuxspeech.sh
        ./linuxspeech.sh
    fi

    echo ""
    echo "[Step 4/6] Fixing libraries and common issues..."
    if [ -f "./fix_espeak.sh" ]; then
        chmod +x fix_espeak.sh
        ./fix_espeak.sh
    else
        echo "WARNING: fix_espeak.sh not found."
    fi

    echo ""
    echo "[Step 5/6] Configuring .env file..."
    echo "----------------------------------------------------"
    echo "NOTE: If you already have tokens saved in .env, you can press ENTER"
    echo "to leave a field blank and it will NOT modify that specific value."
    echo "If you don't want to provide a certain credential (e.g. Gemini API Key),"
    echo "just press ENTER."
    echo "----------------------------------------------------"
    
    # Load existing values if .env exists
    if [ -f ".env" ]; then
        cp .env .env.bak
        echo "Existing .env backed up to .env.bak"
        export $(grep -v '^#' .env | xargs)
    fi

    read -p "Discord Bot Token (Current: ${DISCORD_TOKEN:-None}): " INPUT_TOKEN
    DISCORD_TOKEN=${INPUT_TOKEN:-$DISCORD_TOKEN}

    read -p "Discord Client ID (Current: ${CLIENT_ID:-None}): " INPUT_CLIENT_ID
    CLIENT_ID=${INPUT_CLIENT_ID:-$CLIENT_ID}

    read -p "Gemini API Key (Current: ${GEMINI_API_KEY:-None}): " INPUT_GEMINI
    GEMINI_API_KEY=${INPUT_GEMINI:-$GEMINI_API_KEY}

    read -p "Google Cloud API Key (Current: ${GOOGLE_CLOUD_API_KEY:-None}): " INPUT_GCLOUD
    GOOGLE_CLOUD_API_KEY=${INPUT_GCLOUD:-$INPUT_GCLOUD}

    read -p "YouTube API Key (Current: ${YOUTUBE_API_KEY:-None}): " INPUT_YOUTUBE
    YOUTUBE_API_KEY=${INPUT_YOUTUBE:-$YOUTUBE_API_KEY}

    read -p "Bot Owner ID (Current: ${OWNER_ID:-None}): " INPUT_OWNER
    OWNER_ID=${INPUT_OWNER:-$OWNER_ID}

    read -p "AWS Region for Polly (Current: ${AWS_REGION:-None}): " INPUT_AWS_REGION
    AWS_REGION=${INPUT_AWS_REGION:-$AWS_REGION}

    read -p "AWS Access Key ID (Current: ${AWS_ACCESS_KEY_ID:-None}): " INPUT_AWS_ACCESS
    AWS_ACCESS_KEY_ID=${INPUT_AWS_ACCESS:-$AWS_ACCESS_KEY_ID}

    read -p "AWS Secret Access Key (Current: ${AWS_SECRET_ACCESS_KEY:-None}): " INPUT_AWS_SECRET
    AWS_SECRET_ACCESS_KEY=${INPUT_AWS_SECRET:-$AWS_SECRET_ACCESS_KEY}

    cat <<EOF > .env
DISCORD_TOKEN=$DISCORD_TOKEN
CLIENT_ID=$CLIENT_ID
GEMINI_API_KEY=$GEMINI_API_KEY
GOOGLE_CLOUD_API_KEY=$GOOGLE_CLOUD_API_KEY
YOUTUBE_API_KEY=$YOUTUBE_API_KEY
OWNER_ID=$OWNER_ID
AWS_REGION=$AWS_REGION
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
EOF

    echo ""
    echo "[Step 6/6] Finalizing setup..."
    # Ensure all scripts are executable
    chmod +x *.sh 2>/dev/null

    echo ""
    echo "SUCCESS: Galacticord is fully installed and configured!"
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
