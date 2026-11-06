#!/bin/sh
set -eu
# Windows bind mounts cannot supply PostgreSQL's required private-key ownership.
install -o postgres -g postgres -m 600 /fixture/server.key /tmp/server.key
install -o postgres -g postgres -m 644 /fixture/server.crt /tmp/server.crt
exec docker-entrypoint.sh postgres -c ssl=on -c ssl_min_protocol_version=TLSv1.2 -c ssl_cert_file=/tmp/server.crt -c ssl_key_file=/tmp/server.key -c hba_file=/fixture/pg_hba.conf
