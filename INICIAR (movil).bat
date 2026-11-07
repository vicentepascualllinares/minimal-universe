@echo off
title MINIMAL UNIVERSE (movil)
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo No se encuentra Node.js. Instalalo desde https://nodejs.org y vuelve a abrir este archivo.
  pause
  exit /b 1
)
echo Si Windows pregunta por el firewall, permite el acceso en redes privadas.
node serve.mjs --open --lan
