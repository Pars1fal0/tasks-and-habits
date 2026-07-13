$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$VenvPython = Join-Path $Root ".venv\Scripts\python.exe"
$ModelDir = Join-Path $Root "model\vosk-model-small-ru-0.22"
$ModelZip = Join-Path $env:TEMP "vosk-model-small-ru-0.22.zip"
$Config = Join-Path $Root "config.json"

Write-Host "[1/5] Preparing Python..."
if (-not (Test-Path $VenvPython)) {
  python -m venv (Join-Path $Root ".venv")
}

Write-Host "[2/5] Installing dependencies..."
& $VenvPython -m pip install --disable-pip-version-check -r (Join-Path $Root "requirements.txt")

if (-not (Test-Path $ModelDir)) {
  Write-Host "[3/5] Downloading the 45 MB Russian Vosk model..."
  New-Item -ItemType Directory -Force -Path (Join-Path $Root "model") | Out-Null
  Invoke-WebRequest -UseBasicParsing -Uri "https://alphacephei.com/vosk/models/vosk-model-small-ru-0.22.zip" -OutFile $ModelZip
  Expand-Archive -Path $ModelZip -DestinationPath (Join-Path $Root "model") -Force
  Remove-Item -LiteralPath $ModelZip -Force
} else {
  Write-Host "[3/5] Speech model is already installed."
}

if (-not (Test-Path $Config)) {
  Copy-Item (Join-Path $Root "config.example.json") $Config
}

Write-Host "[4/5] Adding the assistant to Windows Startup..."
$Startup = [Environment]::GetFolderPath("Startup")
$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut((Join-Path $Startup "Codex Voice Assistant.lnk"))
$Shortcut.TargetPath = (Join-Path $Root "start-hidden.vbs")
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = "Codex voice activation"
$Shortcut.Save()

Write-Host "[5/5] Starting the assistant..."
& (Join-Path $Root "stop.ps1") -Quiet
Start-Process -FilePath "wscript.exe" -ArgumentList ('"' + (Join-Path $Root "start-hidden.vbs") + '"') -WindowStyle Hidden
Start-Sleep -Seconds 3
if (-not (Test-Path (Join-Path $Root "assistant.pid"))) {
  throw "The assistant did not start. Check assistant.log."
}

Write-Host ""
Write-Host "Ready. Say: Codex rabotay" -ForegroundColor Green
Write-Host "After the command say: Otprav"
Write-Host "Log: $(Join-Path $Root 'assistant.log')"
