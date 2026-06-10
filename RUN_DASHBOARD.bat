@echo off
setlocal

cd /d "%~dp0"

echo.
echo ================================================
echo  ADC Clinic - POS Intelligence Dashboard
echo ================================================
echo.

:: Optional: Refresh data from real CSVs using the improved wrapper
echo Refreshing data (this may take a moment)...
python build_dashboard_data.py --verbose
if errorlevel 1 (
    echo [WARNING] Data refresh failed or was skipped.
    echo Using last generated or embedded data.
) else (
    echo Data refresh completed.
)
echo.

set PORT=8765
set DASHBOARD_URL=http://localhost:%PORT%/ADC%%20POS%%20Dashboard.html

echo Starting local web server on port %PORT%...
echo.
echo Open this URL in your browser:
echo   %DASHBOARD_URL%
echo.
echo Press Ctrl+C in this window to stop the server.
echo ================================================
echo.

:: Small delay so the browser doesn't open before the server is ready
timeout /t 1 /nobreak >nul

start "" "%DASHBOARD_URL%"

python -m http.server %PORT%
