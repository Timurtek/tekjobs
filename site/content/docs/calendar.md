---
title: The calendar
order: 6.5
summary: Interviews, follow-ups and deadlines from the notes, a feed for your calendar app, and a read-only check of Google Calendar.
updated: 2026-10-08
---

The Calendar page reads the dated lines the notes carry: interviews from the packet's **Interview on** field, follow-ups from **Follow-up due**, deadlines from **Deadline**, and the applied dates as the trail behind. You fill Interview on yourself (a date and time in your own time zone, like `2026-10-14 15:00`), a confirmed scheduling email fills it when it names a time, and a confirmed calendar event fills it too. Nothing on the page comes from a calendar service; the record is the calendar.

## In your calendar app

The same dates are served as an `.ics` feed at `/api/calendar.ics` on the TekJobs server, the address the page shows. Apple Calendar and Outlook on this machine subscribe to it and refresh on their own; Google Calendar cannot reach your machine, so download the file from the page and import it. Interviews with a time are timed events in your own time zone; follow-ups and deadlines are all-day. TekJobs never writes to your calendar.

## From your Google Calendar

The other direction is a check, like mail. "Check Google Calendar" at the top of the page reads your Google Calendar through the local CLI's connector with only its read tools allowed (list, search, get; create, update, delete and respond are denied by name), finds interviews, screens, onsites, recruiter and offer calls and deadlines about jobs on your board, and shows each one matched to a note, with where it sits against today: happened, today, tomorrow, in N days. Each event's title opens it in Google Calendar.

You confirm each one. Confirming puts the event's time into the note's Interview on field, moves a note that is not yet interviewing to interviewing, or fills Deadline for a deadline, and records the event on the note. A note already rejected or passed never moves because of a calendar event. Dismissing writes nothing.

It needs Claude Code with the Google Calendar connector enabled. The morning task runs it after the mail read; `tekjobs calendar check [--days N]` does the same from a terminal, and `calendar_check` and `calendar_items` over MCP let an agent start a read and tell you what is waiting. Confirming is yours.
