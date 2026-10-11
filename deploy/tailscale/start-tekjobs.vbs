' Starts run-forever.cmd with no visible window, so the TekJobs server stays up for the Tailscale sidecar.
' To start it at login, put a shortcut to this file in shell:startup (Win+R, type shell:startup). A shortcut, not a
' copy: this file finds run-forever.cmd next to itself.
' Log: %USERPROFILE%\.tekjobs\run\api-forever.log. Stop with stop-tekjobs.cmd.
Set fso = CreateObject("Scripting.FileSystemObject")
here = fso.GetParentFolderName(WScript.ScriptFullName)
CreateObject("WScript.Shell").Run Chr(34) & here & "\run-forever.cmd" & Chr(34), 0, False
