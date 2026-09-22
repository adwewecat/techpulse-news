@echo off
chcp 65001 >nul
title TECH PULSE - AI News Radar System

echo ======================================================================
echo    TECH PULSE - HE THONG TONG HOP TIN TUC AI VIET NAM VA THE GIOI
echo ======================================================================
echo Backend: Python 3.14 + FastAPI + JSON Local Storage
echo Frontend: React 19 + TypeScript + Vite
echo.

set "ROOT_DIR=%~dp0"

echo [1/2] Dang khoi dong Backend FastAPI tren Port 8002...
start "TechPulse-Backend" "%ROOT_DIR%backend\run_backend.bat"

timeout /t 3 /nobreak >nul

echo [2/2] Dang khoi dong Frontend React 19 tren Port 5011...
start "TechPulse-Frontend" "%ROOT_DIR%frontend\run_frontend.bat"

timeout /t 3 /nobreak >nul

echo ======================================================================
echo HE THONG DA KHOI DONG THANH CONG!
echo - Web Dashboard:  http://localhost:5011
echo - Swagger API:    http://localhost:8002/docs
echo ======================================================================

start http://localhost:5011
pause
