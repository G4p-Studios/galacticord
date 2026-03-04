@echo off
TITLE Galacticord Windows Setup
echo ====================================================
echo    GALACTICORD DISCORD BOT - WINDOWS SETUP
echo ====================================================
echo 1) Install / Update (Dependencies ^& .env)
echo 2) Start Bot
echo 3) Exit
echo ====================================================
set /p choice="Select an option [1-3]: "

if "%choice%"=="1" (
    echo.
    echo [Step 1/3] Checking Node.js...
    node -v >nul 2>&1
    if %errorlevel% neq 0 (
        echo Error: Node.js is not installed. Please install it from https://nodejs.org/
        pause
        exit /b
    )

    echo [Step 2/3] Installing/Updating npm dependencies...
    echo This includes DAVE encryption support (@snazzah/davey)
    call npm install

    echo [Step 3/3] Configuring .env file...
    powershell -ExecutionPolicy Bypass -File setup.ps1 -ConfigOnly
    
    echo.
    echo SUCCESS: Setup complete! You can now start the bot.
    pause
    goto :eof
)

if "%choice%"=="2" (
    echo Starting Galacticord...
    npm start
    pause
)

if "%choice%"=="3" (
    exit
)
