#!/bin/sh
set -eu
export LC_ALL=C
service=$1 owner=$2 database=$3 digest=$4 system_id=$5 catalog=$6 source_id=$7 target_id=$8 schema=$9
shift 9
expiry=$1 history_after=$2 history_evidence=$3 archive_bytes=$4

# Process a single immutable copy, with no network and no source volume mounted.
test -z "$(find "$PGDATA" -mindepth 1 -print -quit)"
install -m 600 /dev/null /tmp/cluster.tar
if [ -n "$archive_bytes" ]; then
  cat > /tmp/cluster.tar
  # The host appends this digest only after authenticating the complete stream.
  test "$(wc -c < /tmp/cluster.tar)" -eq "$((archive_bytes + 64))"
  digest=$(tail -c 64 /tmp/cluster.tar)
  truncate -s "$archive_bytes" /tmp/cluster.tar
else
  cp /archive.tar /tmp/cluster.tar
fi
printf '%s  %s\n' "$digest" /tmp/cluster.tar | sha256sum -c --status
tar --quoting-style=escape -tvf /tmp/cluster.tar > /tmp/members
awk '{
  member = substr($6, 3)
  if (NF != 6 || $1 !~ /^[d-]/ || $6 !~ /^\.\// ||
      member !~ /^[a-zA-Z0-9_.\/-]*$/ || member ~ /(^|\/)\.\.?(\/|$)/) exit 1
}' /tmp/members
tar --extract --file=/tmp/cluster.tar --directory="$PGDATA" --no-same-owner --no-same-permissions
rm /tmp/cluster.tar
test "$(cat "$PGDATA/PG_VERSION")" = "$PG_MAJOR"
test ! -e "$PGDATA/postmaster.pid"
control=$(pg_controldata "$PGDATA" 2>/tmp/pg-control)
test ! -s /tmp/pg-control
printf '%s\n' "$control" | grep -Eq "^Database system identifier:[[:space:]]+$system_id$"
printf '%s\n' "$control" | grep -Eq "^Catalog version number:[[:space:]]+$catalog$"
printf '%s\n' "$control" | grep -Eq '^Database cluster state:[[:space:]]+shut down$'
chown -R postgres:postgres "$PGDATA"
chmod 700 "$PGDATA"

install -d -o postgres -g postgres -m 700 /tmp/socket
printf '%s\n' 'local all all trust' > /tmp/restore-hba
stop() { gosu postgres pg_ctl -D "$PGDATA" -m fast -w stop >/dev/null; }
gosu postgres pg_ctl -D "$PGDATA" -l /tmp/socket/postgres.log -w start \
  -o "-c config_file=/dev/null -c hba_file=/tmp/restore-hba -c listen_addresses='' -c unix_socket_directories=/tmp/socket" >/dev/null
trap 'stop' EXIT
export PGHOST=/tmp/socket PGUSER="$owner" PGDATABASE="$database"
query() { psql -XAtq -v ON_ERROR_STOP=1 "$@"; }
if [ "$service" = postgres ]; then
  test "$(query -c 'SELECT id FROM public.fixture_identity')" = "$source_id"
  test "$(query -c "SELECT count(*)=1 FROM pilot.tenants WHERE name='Cold Backup Orchard'")" = t
  pg_dump --schema=pilot --schema-only --restrict-key=MaexSocialColdBackupSchema > /tmp/schema
  printf '%s' "$(cat /tmp/schema)" > /tmp/schema-trimmed
  printf '%s  %s\n' "$schema" /tmp/schema-trimmed | sha256sum -c --status
  history_source=NULL
  if [ -n "$history_after" ]; then
    archived_anchor=$(query -c "SELECT restore_history_after || ':' || restore_history_evidence FROM public.fixture_identity")
    test "$archived_anchor" = "$history_after:$history_evidence"
    history_source="'$source_id'"
  fi
  password=$(cat /fixture/owner-password)
  query <<SQL
BEGIN;
ALTER ROLE pilot_owner PASSWORD '$password' VALID UNTIL '$expiry';
ALTER ROLE pilot_app NOLOGIN PASSWORD NULL;
REVOKE CONNECT ON DATABASE pilot_fixture FROM pilot_app;
ALTER TABLE public.fixture_identity ADD COLUMN IF NOT EXISTS restore_target boolean NOT NULL DEFAULT false;
ALTER TABLE public.fixture_identity ADD COLUMN IF NOT EXISTS restore_history_source_id text;
ALTER TABLE public.fixture_identity ADD COLUMN IF NOT EXISTS restore_history_digest text;
UPDATE public.fixture_identity SET id='$target_id', restore_target=true, restore_history_source_id=$history_source;
UPDATE pilot.dispatch_control SET stopped=true WHERE singleton;
COMMIT;
SQL
else
  test "$(query -c "SELECT count(*)=1 FROM user_entity JOIN realm ON realm.id=user_entity.realm_id
    WHERE realm.name='pilot' AND NOT user_entity.enabled AND username='cold-backup-$source_id'")" = t
  test "$(query -c "SELECT encode(sha256(convert_to(string_agg(concat_ws('|', id, author, filename, md5sum),
      chr(10) ORDER BY orderexecuted), 'UTF8')), 'hex') FROM databasechangelog")" = "$schema"
  password=$(cat /fixture/identity-password)
  query <<SQL
BEGIN;
ALTER ROLE identity_owner PASSWORD '$password' VALID UNTIL '$expiry';
ALTER ROLE keycloak NOLOGIN PASSWORD NULL;
COMMIT;
SQL
fi
stop
trap - EXIT
