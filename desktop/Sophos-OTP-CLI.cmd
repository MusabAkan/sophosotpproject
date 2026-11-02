@echo off
setlocal
set "ELECTRON_RUN_AS_NODE=1"
"%~dp0Sophos OTP.exe" "%~dp0resources\app.asar\cli\index.cjs" %*
exit /b %errorlevel%
