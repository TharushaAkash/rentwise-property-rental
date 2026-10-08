param(
  [Parameter(Mandatory=$true)][string]$TargetUrl,
  [ValidateSet('Baseline','Api')][string]$Mode = 'Baseline',
  [string]$RunLabel = 'initial-run'
)
$ErrorActionPreference = 'Stop'
if ($TargetUrl -notmatch '^https?://') { throw 'Supply an HTTP/HTTPS URL' }
if ($RunLabel -notmatch '^[a-zA-Z0-9_-]+$') { throw 'RunLabel must contain only letters, digits, underscore or hyphen' }
$reportFolder = Join-Path $PSScriptRoot "../evidence/$RunLabel/zap"
New-Item -ItemType Directory -Force -Path $reportFolder | Out-Null
$reportFolder = (Resolve-Path -LiteralPath $reportFolder).Path
$image = 'ghcr.io/zaproxy/zaproxy:stable'
$script = if ($Mode -eq 'Api') { 'zap-api-scan.py' } else { 'zap-baseline.py' }
$scanArguments = @('run','--rm','-v',"${reportFolder}:/zap/wrk/:rw",$image,$script,'-t',$TargetUrl,'-r',"$Mode.html",'-J',"$Mode.json")
if ($Mode -eq 'Api') { $scanArguments += @('-f','openapi') }
Get-Command docker -ErrorAction Stop | Out-Null
# Windows PowerShell wraps native stderr as ErrorRecords, including normal
# Docker image-pull progress. Judge the command by its exit code instead.
$previousErrorPreference = $ErrorActionPreference
$previousNativePreference = $PSNativeCommandUseErrorActionPreference
try {
  $ErrorActionPreference = 'Continue'
  $PSNativeCommandUseErrorActionPreference = $false
  & docker @scanArguments 2>&1 | ForEach-Object { $_.ToString() } | Tee-Object -FilePath (Join-Path $reportFolder "$Mode-console.txt")
  $scanExit = $LASTEXITCODE
} finally {
  $ErrorActionPreference = $previousErrorPreference
  $PSNativeCommandUseErrorActionPreference = $previousNativePreference
}
if ($scanExit -notin @(0, 1, 2, 3)) {
  Write-Host "Docker execution failed (exit $scanExit); the ZAP scan did not complete. Check the console log."
  exit $scanExit
}
Write-Host "ZAP exit code: $scanExit (0 clean; 1 FAIL alerts; 2 WARN alerts; 3 execution error)"
exit $scanExit
