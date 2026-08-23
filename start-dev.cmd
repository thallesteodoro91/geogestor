@echo off
setlocal
cd /d "%~dp0"
where pnpm.cmd >nul 2>nul
if errorlevel 1 (
  echo pnpm 11.8.0 nao foi encontrado no PATH.
  exit /b 1
)
echo [%date% %time%] Starting GeoGestor dev server...
pnpm.cmd dev
