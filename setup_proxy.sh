#!/bin/bash

# setup_proxy.sh - Sets up the URnetwork proxy for Galacticord

echo "Starting URnetwork Proxy Setup..."

# 1. Create a folder for the proxy
mkdir -p ~/urnetwork
cd ~/bot_backups || cd ~ # Try to stay in a safe place

# 2. Download the proxy (Linux 64-bit SOCKS version)
echo "[1/3] Downloading URnetwork Proxy..."
# Using the specific release tag provided by the user
URL="https://github.com/urnetwork/build/releases/download/v2026.2.4-854737690/urnetwork-proxy-socks-linux-amd64.tar.gz"
wget -q --show-progress -O urnetwork-proxy.tar.gz "$URL"

# 3. Extract
echo "[2/3] Extracting..."
# List contents to see if it's a folder or binary
tar -tf urnetwork-proxy.tar.gz
# Extract everything into the urnetwork directory, flattening any top-level folder
tar -xzf urnetwork-proxy.tar.gz -C ~/urnetwork --strip-components=1 2>/dev/null || tar -xzf urnetwork-proxy.tar.gz -C ~/urnetwork
rm urnetwork-proxy.tar.gz

# Check for the binary and make it executable
cd ~/urnetwork
chmod +x urnetwork-proxy-socks 2>/dev/null || chmod +x *proxy*

echo "---------------------------------------------------"
echo "[3/3] Setup Complete!"
echo ""
echo "To run the proxy in the background:"
echo "  cd ~/urnetwork"
echo "  nohup ./urnetwork-proxy-socks -port 9050 > proxy.log 2>&1 &"
echo ""
echo "Once the proxy is running, tell the bot to use it:"
echo "  /set music_proxy target:Server url:socks5://127.0.0.1:9050"
echo "---------------------------------------------------"
