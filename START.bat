@echo off
REM LendStore Quick Start Script for Windows

echo ================================
echo LendStore App - Quick Start
echo ================================
echo.

REM Check if Docker is installed
docker --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Docker is not installed or not in PATH
    echo Please install Docker Desktop from https://www.docker.com/products/docker-desktop
    pause
    exit /b 1
)

echo ✓ Docker found
echo.

REM Check if .env exists
if exist ".env" (
    echo ✓ .env file found
) else (
    echo ✗ .env file NOT found in root directory
    pause
    exit /b 1
)

echo.
echo ================================
echo Starting Services with Docker
echo ================================
echo.

echo This will:
echo 1. Build all containers
echo 2. Create and start MySQL database
echo 3. Initialize database schema
echo 4. Start backend API on port 5000
echo 5. Start frontend on port 80
echo.

pause

docker-compose up --build

echo.
echo ================================
echo Services Started!
echo ================================
echo.
echo Access the app at:
echo - Frontend: http://3.108.233.74
echo - Backend API: http://3.108.233.74:5000
echo - MySQL: 3.108.233.74:3386
echo.
echo To view logs:
echo - All: docker-compose logs -f
echo - Backend: docker-compose logs -f backend
echo - Frontend: docker-compose logs -f frontend
echo - Database: docker-compose logs -f mysql
echo.
echo To stop all services: Press Ctrl+C
echo.
pause
