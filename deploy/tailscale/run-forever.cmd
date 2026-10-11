@echo off
rem Keeps the TekJobs server up for the sidecar to reach: starts app\server\index.mjs, and restarts it 60s after it
rem exits, forever. Started hidden by start-tekjobs.vbs; stopped by stop-tekjobs.cmd.
rem If `tekjobs up` already holds the port, this one exits at once and tries again in 60s, so the two do not fight.
rem Log: %USERPROFILE%\.tekjobs\run\api-forever.log
setlocal
set ROOT=%~dp0..\..
set LOGDIR=%USERPROFILE%\.tekjobs\run
if not exist "%LOGDIR%" mkdir "%LOGDIR%"
cd /d "%ROOT%"
:run
echo [%date% %time%] starting the TekJobs server >> "%LOGDIR%\api-forever.log"
node app\server\index.mjs >> "%LOGDIR%\api-forever.log" 2>&1
echo [%date% %time%] the server exited with %errorlevel%, restarting in 60s >> "%LOGDIR%\api-forever.log"
rem timeout fails without a console (hidden window); ping waits ~60s anywhere.
ping -n 61 127.0.0.1 >nul
goto run
