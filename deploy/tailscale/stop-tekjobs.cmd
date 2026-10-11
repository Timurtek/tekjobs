@echo off
rem Stops what start-tekjobs.vbs started: the run-forever loop and the server under it. `tekjobs down` does not reach
rem these, because they are not the ones `tekjobs up` records.
powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \"Name='cmd.exe'\" | Where-Object { $_.CommandLine -like '*deploy\tailscale\run-forever.cmd*' } | ForEach-Object { taskkill /T /F /PID $_.ProcessId | Out-Null; Write-Output ('stopped run-forever, pid ' + $_.ProcessId) }"
