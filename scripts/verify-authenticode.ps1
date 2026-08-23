$ErrorActionPreference = 'Stop'
$distPath = Join-Path $PSScriptRoot '..\apps\desktop\dist'
$packagePath = Join-Path $PSScriptRoot '..\apps\desktop\package.json'
$version = (Get-Content -LiteralPath $packagePath -Raw | ConvertFrom-Json).version
$commercialVersion = $version -replace '\.0$', ''
$installers = @(Get-ChildItem -LiteralPath $distPath -File | Where-Object { $_.Name -eq "GeoGestor Setup $commercialVersion.exe" })

if ($installers.Count -eq 0) {
  throw "Nenhum instalador encontrado em $distPath"
}

$failures = @()
foreach ($installer in $installers) {
  $signature = Get-AuthenticodeSignature -LiteralPath $installer.FullName
  if ($signature.Status -ne 'Valid') {
    $failures += "$($installer.Name): $($signature.Status)"
  }
}

if ($failures.Count -gt 0) {
  throw "Assinatura Authenticode ausente ou inválida: $($failures -join '; ')"
}

Write-Host "Assinatura Authenticode válida em $($installers.Count) instalador(es)."
