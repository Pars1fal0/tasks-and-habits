param([switch]$Quiet)

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$PidFile = Join-Path $Root "assistant.pid"
if (Test-Path $PidFile) {
  $AssistantPid = (Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1)
  if ($AssistantPid -match '^\d+$') {
    Stop-Process -Id ([int]$AssistantPid) -Force -ErrorAction SilentlyContinue
  }
  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}
if (-not $Quiet) { Write-Host "Codex Voice Assistant stopped." }
