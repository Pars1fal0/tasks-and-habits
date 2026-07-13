$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
  Write-Error "Run install.ps1 first."
  exit 1
}
& $Python (Join-Path $Root "assistant.py")
