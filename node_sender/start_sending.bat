@echo off
echo Starting Magxxic Email Sender (Node.js)...
set FORCE_COLOR=1
node magxxic_sender.js
if %errorlevel% neq 0 (
    echo.
    echo An error occurred while running the script.
    pause
    exit /b %errorlevel%
)
pause
