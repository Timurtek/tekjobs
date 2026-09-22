@echo off
rem Daily TekJobs scan. Invoked by Windows Task Scheduler (task name: TekJobs Daily Scan).
cd /d %~dp0
if not exist data mkdir data
echo ===== %date% %time% ===== >> data\runs.log
node run.mjs >> data\runs.log 2>&1
