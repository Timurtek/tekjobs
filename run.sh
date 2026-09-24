#!/bin/sh
# Daily TekJobs scan for cron and launchd: the scan, then the read-only mail pass. `tekjobs schedule` prints
# the one line that calls this at 07:30; run.cmd is the Windows twin.
cd "$(dirname "$0")" || exit 1
export TEKJOBS_RUN_VIA=schedule
mkdir -p data
{
  echo "===== $(date) ====="
  node run.mjs
  echo "----- mail $(date) -----"
  node cli.mjs mail
} >> data/runs.log 2>&1
