$ErrorActionPreference = 'Stop'
$config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.local.json') -Raw | ConvertFrom-Json
$created = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'evidence/INT-03-created-property.json') -Raw | ConvertFrom-Json
if ($config.apiBaseUrl.TrimEnd('/') -ne $created.apiBaseUrl) { throw 'API URLs differ; use the same backend for both platforms' }
$mobileConfig = @{
 API_BASE_URL = $created.apiBaseUrl
 OWNER_EMAIL = $config.ownerEmail
 OWNER_PASSWORD = $config.ownerPassword
 EXPECTED_PROPERTY_ID = $created.id
 EXPECTED_TITLE = $created.title
 EXPECTED_ADDRESS = $created.address
 EXPECTED_RENT = [string]$created.monthlyRent
}
$mobileConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot 'mobile.local.json') -Encoding UTF8
Write-Host 'Ignored mobile.local.json prepared. It contains test credentials; do not commit it.'
