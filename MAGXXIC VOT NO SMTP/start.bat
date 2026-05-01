@echo off
title MAGXXIC VOT NO SMTP - LAUNCHER
color 0b

:: Check if node_modules exists
if not exist "node_modules\" (
    echo [ERROR] Dependencies not found!
    echo Please run setup.bat first.
    pause
    exit /b
)

:: Launch the application
echo [INFO] Starting MAGXXIC VOT NO SMTP...
node magxxic_sender.js
pause
