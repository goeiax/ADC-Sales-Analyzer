' Start-Dashboard-Full.vbs
' Double-click this file to launch the ADC Dashboard with the console completely hidden.
' This version runs the full data refresh first (slower but always up-to-date).
' The server will automatically stop after 30 minutes of inactivity (no HTTP requests).
' Requires Python installed and pythonw.exe available in PATH.

Set fso = CreateObject("Scripting.FileSystemObject")
Set WshShell = CreateObject("WScript.Shell")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = scriptDir

' Run the data refresh using the local self-contained ETL (pythonw = no console)
' We run it synchronously (True) so the refresh finishes before the server starts.
WshShell.Run "pythonw build_dashboard_data.py --verbose", 0, True

' Launch the SMART HTTP server (auto-shutdown after 30 min inactivity) using pythonw
WshShell.Run "pythonw smart_http_server.py 30", 0, False

' Small delay before opening browser
WScript.Sleep 1500

' Open the dashboard
WshShell.Run "http://localhost:8765/ADC%20POS%20Dashboard.html", 1, False

' The script ends here. The smart server keeps running in the background.
' It will automatically shut down after 30 minutes of no requests.
' To stop it earlier, use Task Manager and end the pythonw.exe process.
