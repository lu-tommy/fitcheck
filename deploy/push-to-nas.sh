#!/bin/sh
# Ship this working copy to the NAS and rebuild, without ever touching the
# wardrobes.
#
# Two things have gone wrong doing this by hand, and both are guarded here:
#
#   data/   The working copy has one (gitignored). A plain `tar .` includes it,
#           and extracting that over the NAS overwrites live wardrobes with
#           whatever stale copy happens to be on this machine. Excluded, and
#           the archive is checked for it before anything is sent.
#
#   uid     The image runs as uid 1001 but a bind mount keeps the HOST's
#           ownership, so a data folder owned by anyone else leaves the app able
#           to read and not write: every /api/sync/push then returns 500 and no
#           closet is backed up. Re-asserted after every deploy, because
#           extracting an archive can reset it.
#
# Usage: deploy/push-to-nas.sh [user@host] [remote-dir]
set -e
HOST="${1:-Tommy@192.168.50.2}"
DIR="${2:-/volume2/docker/fitcheck}"
TMP="$(mktemp -t fitcheck-src).tgz"

echo "Packing (excluding data/, .env, node_modules, .next, .git)…"
tar czf "$TMP" \
  --exclude=./data --exclude=./node_modules --exclude=./.next --exclude=./.git \
  --exclude=./.env --exclude=./.env.local --exclude='*.log' .

if tar tzf "$TMP" | grep -q '^\./data/'; then
  echo "REFUSING TO DEPLOY: the archive contains data/ — that would overwrite wardrobes." >&2
  rm -f "$TMP"; exit 1
fi
echo "  $(du -h "$TMP" | cut -f1), no data/ inside."

echo "Sending… (scp/sftp is not available on this host, so this pipes over ssh)"
cat "$TMP" | ssh "$HOST" "cat > /tmp/fitcheck-src.tgz"
rm -f "$TMP"

ssh "$HOST" "sudo sh -s" <<REMOTE
set -e
cd "$DIR"
rm -rf /tmp/fitcheck-unpack && mkdir -p /tmp/fitcheck-unpack
tar xzf /tmp/fitcheck-src.tgz -C /tmp/fitcheck-unpack
cd /tmp/fitcheck-unpack && tar cf - --exclude=./.env --exclude=./.env.local . | (cd "$DIR" && tar xf -)
cd "$DIR"
docker compose build
docker compose up -d
# after every deploy, not just the first
chown -R 1001:1001 "$DIR/data"
echo "data owner: \$(stat -c '%u:%g' "$DIR/data")"
REMOTE
echo "Done. Check: docker inspect fitcheck --format '{{.State.Health.Status}}'"
