@echo off
echo Starting Magxxic Email Sender...
python magxxic_sender.py
if %errorlevel% neq 0 (
    echo.
    echo An error occurred while running the script.
    pause
    exit /b %errorlevel%
)
pause
