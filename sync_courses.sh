#!/usr/bin/env bash
SCRIPT="$(dirname "$0")/../kurssisivusto-new/scripts/sync_courses.py"
if [ -f "$SCRIPT" ]; then
  python3 "$SCRIPT" "$@"
else
  echo "❌ sync_courses.py ei löytynyt polusta $SCRIPT"
fi

