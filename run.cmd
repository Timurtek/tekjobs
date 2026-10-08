@echo off
rem Daily TekJobs scan. Invoked by Windows Task Scheduler (task name: TekJobs Daily Scan).
cd /d %~dp0
set TEKJOBS_RUN_VIA=schedule
if not exist data mkdir data
echo ===== %date% %time% ===== >> data\runs.log
node run.mjs >> data\runs.log 2>&1
rem Then the mailbox: a read-only pass through the local CLI's Gmail connector, matched to the notes for you to confirm in the app.
echo ----- mail %date% %time% ----- >> data\runs.log
node cli.mjs mail >> data\runs.log 2>&1
rem Then the calendar: a read-only pass through the Google Calendar connector for interviews and calls about jobs on the board, matched to the notes for you to confirm.
echo ----- calendar %date% %time% ----- >> data\runs.log
node cli.mjs calendar check >> data\runs.log 2>&1
