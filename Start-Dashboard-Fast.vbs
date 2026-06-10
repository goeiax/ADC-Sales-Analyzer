' Start-Dashboard-Fast.vbs
' Double-click this file to launch the ADC Dashboard with the console completely hidden.
' This version skips the data refresh for the fastest possible start.
' The server will automatically stop after 15 minutes of inactivity (no HTTP requests).
' Requires Python installed and pythonw.exe available in PATH.

Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

' Get the directory where this .vbs file lives (so it works from anywhere)
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Launch the SMART HTTP server (auto-shutdown after 15 min inactivity) using pythonw (no console)
' 0 = hidden window, False = don't wait
WshShell.Run "pythonw smart_http_server.py 15", 0, False

' Small delay so the server has a moment to start before we open the browser
WScript.Sleep 1500

' Open the dashboard in the default browser
WshShell.Run "http://localhost:8765/ADC%20POS%20Dashboard.html", 1, False

' The script ends here. The smart server keeps running in the background.
' It will automatically shut down after 15 minutes of no requests.
' To stop it earlier, use Task Manager and end the pythonw.exe process,
' or run: taskkill /F /IM pythonw.exe
