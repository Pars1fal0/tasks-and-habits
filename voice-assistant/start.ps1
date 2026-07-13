$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Python = Join-Path $Root ".venv\Scripts\python.exe"
if (-not (Test-Path $Python)) {
  Write-Error "Run install.ps1 first."
  exit 1
}
& $Python -c "import sounddevice, vosk, win32gui" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Error "Voice assistant dependencies are incomplete. Run install.ps1 again."
  exit 1
}
& $Python (Join-Path $Root "assistant.py")
