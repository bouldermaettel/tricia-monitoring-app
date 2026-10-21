#!/usr/bin/env bash
set -euo pipefail

# UserPromptSubmit hooks may run with a working directory other than the
# repository root, so resolve the project from this script's location.
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
GRAPH_FILE="${REPO_ROOT}/graphify-out/graph.json"

# A hook must not prevent the prompt from being submitted if Graphify is not
# available or the graph has not been built yet.
if [[ ! -f "${GRAPH_FILE}" ]] || ! command -v graphify >/dev/null 2>&1; then
  exit 0
fi

export GRAPHIFY_REPO_ROOT="${REPO_ROOT}"
export GRAPHIFY_QUERY_BUDGET="${GRAPHIFY_QUERY_BUDGET:-1200}"
HOOK_INPUT="$(cat)"

python3 3<<<"${HOOK_INPUT}" <<'PY'
import json
import os
import subprocess
import sys

try:
    hook_input = json.load(os.fdopen(3))
    prompt = hook_input.get("prompt", "")
except (json.JSONDecodeError, OSError, TypeError):
    sys.exit(0)

if not isinstance(prompt, str) or not prompt.strip():
    sys.exit(0)

try:
    result = subprocess.run(
        [
            "graphify",
            "query",
            prompt,
            "--budget",
            os.environ["GRAPHIFY_QUERY_BUDGET"],
        ],
        cwd=os.environ["GRAPHIFY_REPO_ROOT"],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
except (OSError, subprocess.TimeoutExpired):
    sys.exit(0)

context = result.stdout.strip()
if result.returncode != 0 or not context:
    sys.exit(0)

json.dump(
    {
        "hookSpecificOutput": {
            "hookEventName": "UserPromptSubmit",
            "additionalContext": context,
        }
    },
    sys.stdout,
)
PY
