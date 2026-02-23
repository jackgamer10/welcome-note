@echo off
set FORCE_COLOR=1
echo Setting up Magxxic Email Sender...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo.
    echo Installation failed. Please ensure Python and pip are installed and added to your PATH.
    pause
    exit /b %errorlevel%
)
echo.
echo Setup complete! You can now use start_sending.bat to run the tool.
pause
