@echo off
cd /d "%~dp0"
if not exist node_modules (
  call npm.cmd install --cache .npm-cache
  if errorlevel 1 goto fail
)
echo Arayuz: http://127.0.0.1:4200
call npm.cmd run dev
if errorlevel 1 goto fail
exit /b 0
:fail
echo Baslatma basarisiz. Node.js 24 ve internet baglantisini kontrol edin.
pause
exit /b 1

