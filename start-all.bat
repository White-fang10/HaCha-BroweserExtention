@echo off
echo ===================================================
echo     Starting HaCha AI Fact Checker Services
echo ===================================================

echo.
echo [1/4] Starting Docker Infrastructure (Redis)...
cd docker
call docker-compose up -d
cd ..

echo.
echo [2/4] Building Chrome Extension...
cd extension
call npm install
call npm run build
cd ..

echo.
echo [3/4] Starting Node.js Backend Gateway in a new window...
cd backend
start "HaCha Backend Gateway" cmd /k "npm install && npm run dev"
cd ..

echo.
echo [4/4] Starting Python AI Microservice in a new window...
cd ai-service
start "HaCha AI Microservice" cmd /k "if not exist venv (python -m venv venv) && call venv\Scripts\activate && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8000"
cd ..

echo.
echo ===================================================
echo     All Services Started Successfully!
echo ===================================================
echo.
echo Backend Gateway: http://localhost:3000
echo Python AI Service: http://localhost:8000
echo Chrome Extension: Load unpacked from the 'extension' directory.
echo.
pause
