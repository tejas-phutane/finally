# Start FinAlly in Docker (Windows PowerShell).
#
# Usage: scripts\start_windows.ps1 [-Build] [-Open]
#   -Build  rebuild the image before starting
#   -Open   open the app in the default browser once it responds
#
# Idempotent: safe to run repeatedly. The data volume is never removed.

param(
    [switch]$Build,
    [switch]$Open
)

$ErrorActionPreference = 'Stop'

$Image = 'finally'
$Container = 'finally-app'
$Volume = 'finally-data'
$Port = 8000
$Url = "http://localhost:$Port"

$RootDir = Split-Path -Parent $PSScriptRoot
Set-Location $RootDir

function Test-Container([string]$Name, [bool]$IncludeStopped) {
    $cmdArgs = @('ps', '--format', '{{.Names}}')
    if ($IncludeStopped) { $cmdArgs = @('ps', '-a', '--format', '{{.Names}}') }
    $names = & docker @cmdArgs
    return ($names -contains $Name)
}

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker is not installed or not on PATH.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'The Docker daemon is not running. Start Docker Desktop and try again.'
}
if (-not (Test-Path '.env')) {
    throw "$RootDir\.env not found. Copy .env.example to .env and set OPENROUTER_API_KEY."
}

$imageId = docker images -q $Image
if ($Build -or [string]::IsNullOrWhiteSpace($imageId)) {
    Write-Host "Building image '$Image'..."
    docker build -t $Image .
    if ($LASTEXITCODE -ne 0) { throw 'docker build failed.' }
}

if ((Test-Container $Container $false) -and (-not $Build)) {
    Write-Host 'FinAlly is already running.'
} else {
    if (Test-Container $Container $true) {
        docker rm -f $Container *> $null
    }
    Write-Host "Starting container '$Container'..."
    docker run -d `
        --name $Container `
        --restart unless-stopped `
        -v "${Volume}:/app/db" `
        -p "${Port}:8000" `
        --env-file .env `
        $Image | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'docker run failed (is port 8000 already in use?).' }
}

Write-Host "Waiting for $Url/api/health ..."
$ready = $false
for ($i = 0; $i -lt 30; $i++) {
    try {
        $resp = Invoke-WebRequest -Uri "$Url/api/health" -UseBasicParsing -TimeoutSec 2
        if ($resp.StatusCode -eq 200) { $ready = $true; break }
    } catch {
        Start-Sleep -Seconds 1
    }
}

if ($ready) {
    Write-Host "FinAlly is ready at $Url"
    if ($Open) { Start-Process $Url }
} else {
    Write-Warning "$Url/api/health did not respond within 30s. Check logs with: docker logs $Container"
    exit 1
}
