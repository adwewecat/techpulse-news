@echo off
chcp 65001 >nul
title TechPulse - Backend FastAPI (Port 8002)
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
set "PYTHONPATH=%~dp0"
set "PYTHONIOENCODING=utf-8"
echo ===================================================
echo   DANG CHAY TECH PULSE BACKEND (FASTAPI + JSON)
echo   API Docs: http://localhost:8002/docs
echo ===================================================
python run.py
if errorlevel 1 pause
