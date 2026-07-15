#!/bin/sh
# Apply any pending migrations, then hand off to the CMD (gunicorn).
#
# This is safe for a single-instance deploy. If you ever scale to multiple
# replicas, move this into a one-off release/task step instead - concurrent
# containers racing on `alembic upgrade` can deadlock.
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Starting application..."
exec "$@"
