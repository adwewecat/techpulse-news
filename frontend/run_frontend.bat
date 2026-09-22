@echo off
chcp 65001 >nul
title TechPulse - Frontend React (Port 5011)
cd /d "%~dp0"
set "PATH=C:\Program Files\nodejs;%LOCALAPPDATA%\Programs\Python\Python314;%LOCALAPPDATA%\Programs\Python\Python314\Scripts;%PATH%"
echo ===================================================
echo   DANG CHAY TECH PULSE FRONTEND (REACT 19 + VITE)
echo   Dashboard: http://localhost:5011
echo ===================================================
call npm.cmd run dev
if errorlevel 1 pause
