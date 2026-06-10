<#
.SYNOPSIS
    Professional launcher for the ADC POS Intelligence Dashboard on Windows 11.

.DESCRIPTION
    This PowerShell script provides a clean, reliable way to run the dashboard.
    It handles data refresh, starts a local HTTP server, and opens the browser.

.PARAMETER Port
    The port to run the HTTP server on (default: 8765).

.PARAMETER SkipDataRefresh
    Skip refreshing data from CSV files. Useful for quick testing.

.EXAMPLE
    .\Run-Dashboard.ps1

.EXAMPLE
    .\Run-Dashboard.ps1 -Port 8080 -SkipDataRefresh
#>

[CmdletBinding()]
param(
    [int]$Port = 8765,
    [switch]$SkipDataRefresh
)

# Ensure we run from the script's directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $scriptDir

Write-Host ""
Write-Host ("=" * 48) -ForegroundColor Cyan
Write-Host " ADC Clinic — POS Intelligence Dashboard" -ForegroundColor Cyan
Write-Host ("=" * 48) -ForegroundColor Cyan
Write-Host ""

# Optional: Refresh data using the improved Python wrapper
# The real ETL logic now lives locally in ./etl/build_dashboard_data.py (self-contained).
if (-not $SkipDataRefresh) {
    Write-Host "[1/3] Refreshing data from real Neosoft CSV exports..." -ForegroundColor Yellow
    & python "build_dashboard_data.py" --verbose
    
    if ($LASTEXITCODE -ne 0) {
        Write-Warning "Data refresh reported an issue. The dashboard will use the most recent available data."
    } else {
        Write-Host "Data refresh completed successfully." -ForegroundColor Green
    }
    Write-Host ""
} else {
    Write-Host "[1/3] Skipping data refresh (using existing dashboard-data.json)." -ForegroundColor Gray
    Write-Host ""
}

# Prepare URLs
$localUrl = "http://localhost:$Port/ADC%20POS%20Dashboard.html"

Write-Host "[2/3] Starting local web server on port $Port..." -ForegroundColor Green
Write-Host ""
Write-Host "Open this URL in your browser:" -ForegroundColor White
Write-Host "  $localUrl" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C in this window to stop the server." -ForegroundColor Yellow
Write-Host ("=" * 48) -ForegroundColor Cyan
Write-Host ""

# Small delay so the server has time to start before we open the browser
Start-Sleep -Seconds 1.5

# Open the dashboard in the default browser
Start-Process $localUrl

# Start the Python HTTP server (this will block until stopped)
python -m http.server $Port
