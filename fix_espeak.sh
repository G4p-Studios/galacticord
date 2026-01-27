#!/bin/bash

echo "=== Galacticord eSpeak Fixer ==="

# 1. Locate espeak-ng
ESPEAK_BIN=$(which espeak-ng)
if [ -z "$ESPEAK_BIN" ]; then
    echo "eSpeak-ng not found in PATH. Checking common locations..."
    if [ -f "/usr/local/bin/espeak-ng" ]; then
        ESPEAK_BIN="/usr/local/bin/espeak-ng"
    elif [ -f "/usr/bin/espeak-ng" ]; then
        ESPEAK_BIN="/usr/bin/espeak-ng"
    fi
fi

if [ -z "$ESPEAK_BIN" ]; then
    echo "ERROR: Could not find espeak-ng binary. Installing..."
    sudo apt-get update && sudo apt-get install -y espeak-ng
    ESPEAK_BIN=$(which espeak-ng)
fi

echo "Found eSpeak at: $ESPEAK_BIN"

# 2. Check for missing libraries
echo "Checking dependencies..."
MISSING_LIBS=$(ldd "$ESPEAK_BIN" | grep "not found")

if [ -n "$MISSING_LIBS" ]; then
    echo "Found missing libraries:"
    echo "$MISSING_LIBS"
    
    echo "Attempting to fix by updating library cache..."
    sudo ldconfig
    
    # Check again
    MISSING_LIBS=$(ldd "$ESPEAK_BIN" | grep "not found")
    if [ -n "$MISSING_LIBS" ]; then
        echo "Still missing libraries. Reinstalling espeak-ng..."
        sudo apt-get remove -y espeak-ng
        sudo apt-get install -y espeak-ng
    else
        echo "Library cache updated. Dependencies resolved."
    fi
else
    echo "All dependencies look correct."
fi

# 3. Verify execution
echo "Testing eSpeak..."
if "$ESPEAK_BIN" --version > /dev/null 2>&1; then
    echo "SUCCESS: eSpeak is working correctly!"
else
    echo "FAILURE: eSpeak failed to run. Check the errors above."
fi
