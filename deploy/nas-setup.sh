#!/bin/sh
# Bring OutfitAI up on the NAS, or update it in place.
#
# Safe to run repeatedly. It never touches Nginx Proxy Manager, and it never
# touches ./data — the wardrobes survive every rebuild.
#
#   sh deploy/nas-setup.sh
set -eu

cd "$(dirname "$0")/.."

if [ ! -f .env ]; then
  echo "No .env here. Create it first:"
  echo
  echo "  OUTFITAI_SECRET=<64 hex characters>"
  echo "  OUTFITAI_USERS=<name:salt:hash;name:salt:hash>"
  echo
  echo "Generate a secret with:"
  echo "  node -e \"console.log(require('node:crypto').randomBytes(32).toString('hex'))\""
  exit 1
fi

# A missing or half-written secret signs everybody out on every restart.
if ! grep -q '^OUTFITAI_SECRET=.\{32,\}' .env; then
  echo "OUTFITAI_SECRET in .env is missing or too short (needs 32+ characters)."
  exit 1
fi
if ! grep -q '^OUTFITAI_USERS=..*:..*:..*' .env; then
  echo "OUTFITAI_USERS in .env has no name:salt:hash entries."
  exit 1
fi

# The image runs as uid 1001, but a bind-mounted folder keeps the host's
# ownership — so a data directory created by root is read-only to the app and
# every sync fails with a 500. Make sure it is owned by the right user.
mkdir -p data
if [ "$(stat -c %u data 2>/dev/null || echo 0)" != "1001" ]; then
  echo "Fixing ownership of ./data for the container user…"
  chown -R 1001:1001 data 2>/dev/null || sudo chown -R 1001:1001 data
fi

compose() {
  if docker compose version >/dev/null 2>&1; then docker compose "$@";
  else docker-compose "$@"; fi
}

echo "Building…"
compose build

echo "Starting…"
compose up -d

echo "Waiting for it to answer…"
i=0
while [ "$i" -lt 60 ]; do
  if wget -qO- http://127.0.0.1:3210/api/auth/me >/dev/null 2>&1; then
    echo
    echo "Up. It answers on http://$(hostname -i 2>/dev/null | awk '{print $1}'):3210"
    echo
    echo "Now add a Proxy Host in Nginx Proxy Manager:"
    echo "  Domain            fitcheck.tommyluhome.duckdns.org"
    echo "  Scheme            http"
    echo "  Forward hostname  this NAS's LAN address"
    echo "  Forward port      3210"
    echo "  Websockets        on"
    echo "  Block common exploits, and request a Let's Encrypt certificate"
    echo
    echo "Wardrobes are in $(pwd)/data — back that up."
    exit 0
  fi
  i=$((i + 2))
  sleep 2
done

echo "It did not answer within 60s. Recent logs:"
compose logs --tail 40 outfitai
exit 1
