# Stop and remove the FinAlly container (Windows PowerShell).
# The data volume 'finally-data' is kept, so portfolio data persists.
# Idempotent: succeeds if the container does not exist.

$ErrorActionPreference = 'Stop'

$Container = 'finally-app'

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw 'docker is not installed or not on PATH.'
}
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    throw 'The Docker daemon is not running.'
}

$names = docker ps -a --format '{{.Names}}'
if ($names -contains $Container) {
    docker rm -f $Container *> $null
    Write-Host "Stopped and removed '$Container'. Data volume 'finally-data' was kept."
} else {
    Write-Host "No container named '$Container' found. Nothing to stop."
}
