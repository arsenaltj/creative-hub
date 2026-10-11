<# :
@echo off
setlocal
set "CREATIVE_HUB_INSTALLER=%~f0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -ExecutionPolicy Bypass -Command "$source=[IO.File]::ReadAllText($env:CREATIVE_HUB_INSTALLER); & ([scriptblock]::Create($source))"
set "BADGE_EXIT=%ERRORLEVEL%"
if not "%BADGE_EXIT%"=="0" echo Installation failed. See the message above.
pause
exit /b %BADGE_EXIT%
#>
param([switch]$Functions)
$ErrorActionPreference = 'Stop'

function Assert-HubDigest([string]$Archive, [string]$Expected) {
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $Expected) {
        throw 'Downloaded package checksum mismatch. Nothing was installed.'
    }
}
function Expand-HubArchive([string]$Archive, [string]$Destination, [string]$Name) {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::OpenRead($Archive)
    try {
        if ($zip.Entries.Count -lt 1 -or $zip.Entries.Count -gt 100) { throw 'Unexpected ZIP entry count' }
        $size = 0L
        $seen = @{}
        foreach ($entry in $zip.Entries) {
            $file = $entry.FullName
            if (!$file.StartsWith($Name + '/', [StringComparison]::Ordinal) -or $file.Contains('\') -or $file.Contains(':') -or
                ($file.Split('/') | Where-Object { $_ -in @('..','.') }) -or $seen.ContainsKey($file.ToLowerInvariant())) {
                throw 'Unsafe ZIP entry'
            }
            $seen[$file.ToLowerInvariant()] = $true
            $size += $entry.Length
            if ($size -gt 52428800) { throw 'ZIP exceeds uncompressed size limit' }
        }
    } finally { $zip.Dispose() }
    if (Test-Path -LiteralPath $Destination) { throw 'Extraction destination already exists' }
    Expand-Archive -LiteralPath $Archive -DestinationPath $Destination
    $manager = Join-Path $Destination ($Name + '/manage-windows.ps1')
    if (!(Test-Path -LiteralPath $manager -PathType Leaf)) { throw 'Package installer missing' }
    return $manager
}
function Invoke-HubManager([string]$Manager) {
    $shell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
    & $shell -NoProfile -ExecutionPolicy Bypass -File $Manager -Action Install -DisableAutoUpdate
    if ($LASTEXITCODE -ne 0) { throw 'Badge installer failed' }
}
function Install-HubRelease {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $tempBase = [IO.Path]::GetFullPath([IO.Path]::GetTempPath())
    $task = Join-Path $tempBase ('creativehub-badge-' + [guid]::NewGuid().ToString('N'))
    [void][IO.Directory]::CreateDirectory($task)
    try {
        $archive = Join-Path $task 'package.zip'
        Write-Host 'Downloading Creative Hub Codex Usage Badge 0.10.1-hub.1 ...'
        Invoke-WebRequest -Uri 'https://github.com/arsenaltj/creative-hub/releases/download/codex-usage-badge-v0.10.1-hub.1/CodexUsageBadge-Windows-0.10.1-hub.1.zip' -OutFile $archive -UseBasicParsing -TimeoutSec 120
        Assert-HubDigest $archive 'c1c7a69c214d1994d14032cff4ab54be800cf3fe617be4e90b4968135a17a483'
        $manager = Expand-HubArchive $archive (Join-Path $task 'unpacked') 'CodexUsageBadge-Windows-0.10.1-hub.1'
        Invoke-HubManager $manager
        Write-Host 'Done. Fully quit Codex, then open the desktop shortcut: Codex Usage Badge Hub.'
    } finally {
        $resolved = [IO.Path]::GetFullPath($task)
        if (!(Split-Path -Parent $resolved).Equals($tempBase.TrimEnd('\','/'), [StringComparison]::OrdinalIgnoreCase) -or
            (Split-Path -Leaf $resolved) -notlike 'creativehub-badge-*') { throw 'Unsafe cleanup path' }
        if (Test-Path -LiteralPath $resolved) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    }
}
if ($Functions) { return }
try { Install-HubRelease } catch { Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red; exit 1 }
