#!/usr/bin/env bash
# Read-only environment inspection. Does not dump environment variables, config,
# IP addresses, credentials, SSH keys, containers or business process names.
set -u
printf '\n=== OS ===\n'
if [ -f /etc/os-release ]; then grep -E '^(PRETTY_NAME|ID|VERSION_ID)=' /etc/os-release; else uname -s; fi
printf '\n=== Architecture / CPU ===\n'
uname -m
getconf _NPROCESSORS_ONLN 2>/dev/null || true
printf '\n=== Memory / root filesystem ===\n'
free -h 2>/dev/null || true
df -h / 2>/dev/null || true
printf '\n=== Docker / Compose ===\n'
if command -v docker >/dev/null 2>&1; then docker --version; docker compose version 2>/dev/null || true; else echo 'Docker not found'; fi
printf '\n=== Python ===\n'
python3 --version 2>/dev/null || true
printf '\n=== Listeners on 80 / 443 / 8765 (no process names) ===\n'
if command -v ss >/dev/null 2>&1; then ss -ltn 'sport = :80 or sport = :443 or sport = :8765' 2>/dev/null || true; fi
printf '\nNo settings were changed. Review this output before sharing.\n'
