@echo off
cd /d "%~dp0"
cd /d "%~dp0apps\web"
"%~dp0apps\web\node_modules\.bin\vite.CMD" --host 127.0.0.1 --port 5173 > "%~dp0dev-web-menu.log" 2> "%~dp0dev-web-menu.err.log"
