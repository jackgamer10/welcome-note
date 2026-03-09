@echo off
set FORCE_COLOR=1
echo Installing Node.js dependencies for Magxxic...
npm install
if %errorlevel% neq 0 (
    echo.
    echo Failed to install dependencies.
    pause
    exit /b %errorlevel%
)
echo Installation complete.
pause
