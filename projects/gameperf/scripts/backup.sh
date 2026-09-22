#!/usr/bin/env bash
# SQLite's online backup API, not an unsafe copy of an active WAL database.
set -euo pipefail
cd "$(dirname "$0")/.."
umask 077
mkdir -p backups
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
name="gameperf-${stamp}.sqlite3"
docker compose exec -T app python manage.py backup "/tmp/$name"
docker compose cp "app:/tmp/$name" "backups/$name"
chmod 600 "backups/$name"
docker compose exec -T app python -c "from pathlib import Path; Path('/tmp/$name').unlink()"
echo "Backup: backups/$name"
echo 'Contains business records and credential hashes. Protect and copy to an approved backup location.'
