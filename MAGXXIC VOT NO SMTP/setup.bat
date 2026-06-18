@echo off
setlocal enabledelayedexpansion

:: MAGXXIC VOT NO SMTP - SETUP WIZARD
:: =================================

title MAGXXIC VOT NO SMTP - SETUP
color 0b

echo.
echo  ##########################################################
echo  #                                                        #
echo  #         MAGXXIC VOT NO SMTP - SETUP WIZARD             #
echo  #                                                        #
echo  ##########################################################
echo.

:: Check for Node.js
echo [1/3] Checking environment...
node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Node.js is not installed!
    echo Please download and install Node.js from https://nodejs.org/
    pause
    exit /b
)
echo [OK] Node.js is installed.

:: Install Dependencies
echo.
echo [2/3] Installing dependencies...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERROR] Dependency installation failed.
    echo Please check your internet connection and try again.
    pause
    exit /b
)
echo [OK] Dependencies installed successfully.

:: Data Folder Check
echo.
echo [3/3] Verifying data structure...
if not exist "data\recipients.txt" (
    echo [WARNING] data\recipients.txt not found. Creating empty file...
    echo. > data\recipients.txt
)
if not exist "data\subject.txt" (
    echo [WARNING] data\subject.txt not found. Creating empty file...
    echo. > data\subject.txt
)
if not exist "data\link.txt" (
    echo [WARNING] data\link.txt not found. Creating empty file...
    echo. > data\link.txt
)
echo [OK] Data structure verified.

echo.
echo ==========================================================
echo  SETUP COMPLETE!
echo ==========================================================
echo.
echo  To start the application, run:
echo  npm start
echo.
echo  Or:
echo  node magxxic_sender.js
echo.
pause
