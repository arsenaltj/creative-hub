# Tests never run the real installer or query an account.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$source = [IO.File]::ReadAllText((Join-Path $root 'installer/Install-CodexUsageBadge.cmd'))
$tokens = $null; $errors = $null
[void][Management.Automation.Language.Parser]::ParseInput($source, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }
. ([scriptblock]::Create($source)) -Functions
$metadata = Get-Content -LiteralPath (Join-Path $root 'release.json') -Raw | ConvertFrom-Json
$package = Join-Path $root ('dist/' + ($metadata.archive.Split('/')[-1]))
function Assert($Condition, [string]$Message) { if (!$Condition) { throw $Message } }
function Throws([scriptblock]$Body, [string]$Pattern) {
    $failure = $null
    try { & $Body } catch { $failure = $_.Exception.Message }
    Assert ($failure -and $failure -match $Pattern) ('Expected ' + $Pattern + ', got ' + $failure)
}
$temp = Join-Path ([IO.Path]::GetTempPath()) ('badge-bootstrap-test-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($temp)
$script:installed = $false
function Invoke-WebRequest([string]$Uri, [string]$OutFile, [switch]$UseBasicParsing, [int]$TimeoutSec) {
    Assert ($Uri -ceq $metadata.archive) 'Downloader must use the pinned release URL'
    Copy-Item -LiteralPath $package -Destination $OutFile
    if ($script:corrupt) { [IO.File]::AppendAllText($OutFile, 'corrupt') }
}
function Invoke-HubManager([string]$Manager) {
    Assert (Test-Path -LiteralPath $Manager -PathType Leaf) 'Installer file must exist'
    Assert ([IO.File]::ReadAllText($Manager).Contains('creativehub.codexusagebadge.windows')) 'Wrong install ownership'
    $script:installed = $true
    $script:stagedManager = $Manager
}
try {
    Assert-HubDigest $package $metadata.sha256
    Throws { Assert-HubDigest $package ('0' * 64) } 'checksum mismatch'
    Install-HubRelease
    Assert $script:installed 'Verified download was not passed to file installer'
    Assert (!(Test-Path -LiteralPath $script:stagedManager)) 'Temporary extraction must be cleaned'
    $script:installed = $false; $script:corrupt = $true
    Throws { Install-HubRelease } 'checksum mismatch'
    Assert (!$script:installed) 'Corrupt download must never execute'
    $evil = Join-Path $temp 'evil.zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $zip = [IO.Compression.ZipFile]::Open($evil, [IO.Compression.ZipArchiveMode]::Create)
    try { [void]$zip.CreateEntry('package/../outside.ps1') } finally { $zip.Dispose() }
    $destination = Join-Path $temp 'rejected'
    Throws { Expand-HubArchive $evil $destination 'package' } 'Unsafe ZIP entry'
    Assert (!(Test-Path -LiteralPath $destination)) 'Unsafe archive must be rejected before extraction'
    $duplicate = Join-Path $temp 'duplicate.zip'
    $zip = [IO.Compression.ZipFile]::Open($duplicate, [IO.Compression.ZipArchiveMode]::Create)
    try { [void]$zip.CreateEntry('package/a.ps1'); [void]$zip.CreateEntry('package/A.ps1') } finally { $zip.Dispose() }
    Throws { Expand-HubArchive $duplicate $destination 'package' } 'Unsafe ZIP entry'
    Write-Host 'PASS PowerShell 5.1 bootstrap parsing, pinned download, hash rejection, traversal rejection, duplicate rejection, file installation and temporary cleanup'
} finally {
    $resolved = [IO.Path]::GetFullPath($temp)
    Assert ((Split-Path -Parent $resolved).Equals([IO.Path]::GetFullPath([IO.Path]::GetTempPath()).TrimEnd('\','/'), [StringComparison]::OrdinalIgnoreCase) -and (Split-Path -Leaf $resolved) -like 'badge-bootstrap-test-*') 'Unsafe fixture cleanup path'
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
