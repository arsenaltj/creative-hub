#!/usr/bin/env bash
# Deploy only this application. Never installs Docker, alters firewalls or
# overwrites existing reverse-proxy sites. Run from a trusted server terminal.
set -euo pipefail
cd "$(dirname "$0")/.."
mode="${1:-local}"
case "$mode" in local|proxy|tls) ;; *) echo 'Usage: bash scripts/deploy.sh local|proxy|tls'; exit 2;; esac
command -v docker >/dev/null || { echo 'Docker is not installed. Confirm the server plan before installing it.'; exit 1; }
docker compose version >/dev/null
if [ ! -f .env ]; then
    cp .env.example .env
    chmod 600 .env
    echo 'Created .env from the loopback-only example.'
fi
if [ "$mode" != local ]; then
    grep -Eq '^GP_ORIGIN=https://[^ /]+/?$' .env || { echo 'Set GP_ORIGIN=https://YOUR_ACTUAL_DOMAIN in .env.'; exit 1; }
    grep -Eq '^GP_COOKIE_SECURE=true$' .env || { echo 'Set GP_COOKIE_SECURE=true in .env.'; exit 1; }
fi
compose=(docker compose -f compose.yaml)
if [ "$mode" = tls ]; then
    grep -Eq '^GP_DOMAIN=[A-Za-z0-9.-]+$' .env || { echo 'Set a valid GP_DOMAIN in .env.'; exit 1; }
    origin=$(grep '^GP_ORIGIN=' .env | tail -1 | cut -d= -f2-)
    domain=$(grep '^GP_DOMAIN=' .env | tail -1 | cut -d= -f2-)
    [ "${origin%/}" = "https://$domain" ] || { echo 'GP_DOMAIN must match GP_ORIGIN.'; exit 1; }
    echo 'TLS mode will bind host ports 80 and 443. Existing services will NOT be stopped.'
    read -r -p 'Have you confirmed DNS, available ports and authorization? Type DEPLOY: ' approval
    [ "$approval" = DEPLOY ] || exit 1
    compose+=(-f compose.tls.yaml)
fi
"${compose[@]}" config --quiet
"${compose[@]}" up -d --build
"${compose[@]}" ps
printf '\nCreate your administrator (interactive password; no default password):\n'
printf '  docker compose exec app python manage.py create-user admin --role admin\n'
printf '\nCreate a separate reviewer when needed:\n'
printf '  docker compose exec app python manage.py create-user reviewer --role reviewer\n'
printf '\nThis script has NOT opened firewall ports, connected a device, or started an Agent.\n'
