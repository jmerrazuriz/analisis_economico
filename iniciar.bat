@echo off
rem Inicia el panel macro y lo abre en el navegador.
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py --abrir
) else (
  python server.py --abrir
)
pause
