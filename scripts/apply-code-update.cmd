@echo off
setlocal EnableExtensions
REM Replaces the portable exe after the running app has exited, then relaunches.
REM Args: waitPid newExe destExe launchExe
set "WAIT_PID=%~1"
set "NEW_EXE=%~2"
set "DEST_EXE=%~3"
set "LAUNCH_EXE=%~4"

set "TEMP=%LOCALAPPDATA%\Temp"
set "TMP=%TEMP%"
if not exist "%TEMP%" mkdir "%TEMP%"

if "%WAIT_PID%"=="" goto afterwait
:waitloop
tasklist /FI "PID eq %WAIT_PID%" 2>nul | findstr /I /C:"%WAIT_PID%" >nul
if not errorlevel 1 (
  ping -n 2 127.0.0.1 >nul
  goto waitloop
)
:afterwait

if not exist "%NEW_EXE%" exit /b 1

if /I not "%NEW_EXE%"=="%DEST_EXE%" (
  copy /Y "%NEW_EXE%" "%DEST_EXE%" >nul
  if errorlevel 1 exit /b 2
)

if "%LAUNCH_EXE%"=="" set "LAUNCH_EXE=%DEST_EXE%"
start "" "%LAUNCH_EXE%"
exit /b 0
