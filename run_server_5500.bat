@echo off
title Event App Server (Port 5500)
color 0A

echo ======================================================================
echo                  GARBA MAHOTSAV EVENT SERVER
echo ======================================================================
echo.
echo [*] Target Directory : D:\event_v1
echo [*] Local URL        : http://localhost:5500
echo.

:: 1. Navigate to the project directory
echo [1/3] Navigating to D:\event_v1...
cd /d "D:\event_v1"
if %errorlevel% neq 0 (
    echo [ERROR] Failed to switch to D:\event_v1. Does the directory exist?
    echo.
    pause
    exit /b 1
)

:: 2. Check if Node.js is available
echo [2/3] Checking Node.js environment...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js was not found in your system PATH.
    echo Please install Node.js from https://nodejs.org/ and try again.
    echo.
    pause
    exit /b 1
)

:: 3. Check if port 5500 is already active
netstat -ano | findstr :5500 >nul 2>&1
if %errorlevel% equ 0 (
    echo [WARNING] Port 5500 appears to already be in use!
    echo If an existing server instance is running, close it first.
    echo.
)

:: 4. Automatically open default browser after a brief 3-second delay
echo [3/3] Opening browser and starting server...
start "" cmd /c "timeout /t 3 /nobreak >nul & start http://localhost:5500"

echo.
echo ----------------------------------------------------------------------
echo  Server is running at: http://localhost:5500
echo  Press Ctrl+C in this window anytime to stop the server.
echo ----------------------------------------------------------------------
echo.

:: 5. Launch Next.js dev server on port 5500
call npm.cmd run dev -- -p 5500

echo.
echo Server has stopped.
pause
