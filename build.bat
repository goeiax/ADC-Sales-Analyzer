@echo off
REM ============================================================================
REM  Build the standalone "ADC Dashboard.exe"
REM  Run this ONCE on a Windows PC that has Python installed.
REM  The resulting exe runs on ANY Windows laptop with NO Python needed.
REM ============================================================================

echo.
echo [1/3] Installing build tools (PyInstaller + openpyxl)...
python -m pip install --upgrade pyinstaller openpyxl
if errorlevel 1 goto :error

echo.
echo [2/3] Building ADC Dashboard.exe ...
pyinstaller --onefile --name "ADC Dashboard" ^
  --add-data "ADC POS Dashboard.html;." ^
  --add-data "js;js" ^
  --hidden-import etl.build_dashboard_data ^
  --hidden-import openpyxl ^
  app.py
if errorlevel 1 goto :error

echo.
echo [3/3] Done.
echo     The exe is here:  dist\ADC Dashboard.exe
echo.
echo  To distribute: copy "dist\ADC Dashboard.exe" to any Windows laptop,
echo  put the monthly Neosoft CSV exports in a "Raw CSVs" folder beside it,
echo  then double-click the exe.
echo.
pause
goto :eof

:error
echo.
echo  BUILD FAILED. Make sure Python is installed and on PATH.
echo.
pause
