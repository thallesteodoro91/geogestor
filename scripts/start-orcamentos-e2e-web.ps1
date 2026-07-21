$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$webRoot = Join-Path $repoRoot 'apps\web'

Set-Location $webRoot
$env:VITE_API_URL = 'http://127.0.0.1:3191'

& (Join-Path $webRoot 'node_modules\.bin\vite.CMD') '--host' '127.0.0.1' '--port' '5193' '--strictPort'
