$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$databasePath = Join-Path $repoRoot 'scratch\orcamentos-e2e.db'

Set-Location $repoRoot
foreach ($candidate in @($databasePath, "$databasePath-shm", "$databasePath-wal")) {
  Remove-Item -LiteralPath $candidate -Force -ErrorAction SilentlyContinue
}

$env:GEOGESTOR_DB_PATH = $databasePath
$env:PORT = '3191'
$env:GEOGESTOR_WEB_ORIGIN = 'http://127.0.0.1:5193'
$env:GEOGESTOR_DISABLE_SCHEDULER = '1'
Remove-Item Env:GEOGESTOR_API_TOKEN -ErrorAction SilentlyContinue

& (Join-Path $repoRoot 'apps\api\node_modules\.bin\tsx.CMD') 'apps\api\src\server.ts'
