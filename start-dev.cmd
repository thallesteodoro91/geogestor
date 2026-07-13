@echo off
cd /d "%~dp0"
set PATH=C:\Users\Thalles\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin;%PATH%
echo [%date% %time%] Starting GeoGestor dev server...
pnpm dev
