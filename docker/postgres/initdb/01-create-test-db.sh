#!/usr/bin/env bash
set -euo pipefail

psql -v ON_ERROR_STOP=1 \
    --username "$POSTGRES_USER" \
    --dbname "$POSTGRES_DB" \
    --set test_db="${POSTGRES_TEST_DB:-mis_eventos_test}" <<'EOSQL'
CREATE DATABASE :"test_db";
EOSQL
