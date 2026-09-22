# Fixed read-only preflight for the user's existing Windows management path.
# Does not deploy, restart a proxy, change SSH settings, or read private keys.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [ValidateNotNullOrEmpty()]
    [string]$ServerCtlPath,
    [string]$ExpectedHost = $env:GP_EXPECTED_HOST,
    [switch]$Run
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
# Server identity is supplied locally, never committed to this repository.
$Remote = @'
printf '\n=== OS / Architecture ===\n'
uname -sm
test ! -f /etc/os-release || grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release
printf '\n=== Resources ===\n'
getconf _NPROCESSORS_ONLN 2>/dev/null || true
free -h 2>/dev/null || true
df -h /
printf '\n=== Tools ===\n'
if command -v docker >/dev/null 2>&1; then docker --version; docker compose version; else echo 'Docker unavailable'; fi
if command -v caddy >/dev/null 2>&1; then caddy version; else echo 'Caddy binary unavailable'; fi
systemctl is-active caddy 2>/dev/null || true
printf '\n=== Listeners (no process names) ===\n'
if command -v ss >/dev/null 2>&1; then ss -ltn '( sport = :80 or sport = :443 or sport = :8765 )'; fi
printf '\nRead-only preflight finished. No settings were changed.\n'
'@
if (-not $Run) {
    Write-Host 'PLAN ONLY - no SSH or server command was run.'
    Write-Host ('Expected alias/host: srv47 / ' + $ExpectedHost)
    Write-Host 'Execution will use your existing serverctl.ps1 command action.'
    Write-Output $Remote
    Write-Host 'Rerun with -Run to validate the alias and confirm this fixed read-only query.'
    return
}
if ([string]::IsNullOrWhiteSpace($ExpectedHost)) { throw 'Set GP_EXPECTED_HOST or pass -ExpectedHost before running.' }
# Restore a Windows-known folder only in this process if the launcher omitted it.
if (-not $env:ProgramData) { $env:ProgramData = [Environment]::GetFolderPath('CommonApplicationData') }
$Ctl = Get-Item -LiteralPath $ServerCtlPath
if ($Ctl.PSIsContainer -or $Ctl.Extension -ne '.ps1') { throw 'ServerCtlPath must be the existing .ps1 file.' }
$null = Get-Command ssh -ErrorAction Stop
# ssh -G evaluates configuration, not private-key material. Never print all output.
$Resolved = @(& ssh -G srv47 2>$null)
if ($LASTEXITCODE -ne 0) { throw 'Could not resolve the existing SSH alias. No remote action taken.' }
$HostLine = $Resolved | Where-Object { $_ -match '^hostname\s+' } | Select-Object -First 1
if (-not $HostLine) { throw 'The alias did not provide a hostname.' }
$ActualHost = ($HostLine -replace '^hostname\s+', '').Trim()
Remove-Variable Resolved
if ($ActualHost -ne $ExpectedHost) { throw ('Target mismatch: srv47 resolves to ' + $ActualHost + '. Stopping.') }
Write-Host ('Verified alias target: ' + $ActualHost)
Write-Output $Remote
$Answer = Read-Host 'Run this fixed read-only query via the existing serverctl? Type INSPECT'
if ($Answer -cne 'INSPECT') { Write-Host 'Cancelled. No server command executed.'; return }
& $Ctl.FullName command -RemoteCommand $Remote
if (-not $?) { throw 'Existing serverctl reported failure. No proxy restart or fallback attempted.' }
