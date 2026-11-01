@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm.cmd ci --cache .npm-cache
  if errorlevel 1 goto fail
)
echo Developer web interface: http://127.0.0.1:4200
call npm.cmd run dev
exit /b %errorlevel%
:fail
echo Startup failed. Developers need Node.js 24. End users should download the Windows application from Releases.
pause
exit /b 1
