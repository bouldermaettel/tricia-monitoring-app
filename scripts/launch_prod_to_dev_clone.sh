#!/usr/bin/env bash
set -euo pipefail

# Backwards-compatible entrypoint. The generic launcher is direction-aware.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$SCRIPT_DIR/launch_database_clone.sh" prod-to-dev --apply "$@"
