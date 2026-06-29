#!/usr/bin/env bash
# AccessiMind upstream sync + rebuild script.
# Run as root on the VPS after upstream Hermes Agent releases updates.
set -euo pipefail

REPO=/usr/local/lib/hermes-agent
BRANCH=accessimind
UPSTREAM=upstream
ORIGIN=origin
MAIN=main

cd "$REPO"

echo "==> Fetching upstream ..."
git fetch "$UPSTREAM" "$MAIN"

echo "==> Updating local main ..."
git checkout "$MAIN"
git pull --ff-only "$UPSTREAM" "$MAIN"
git push "$ORIGIN" "$MAIN"

echo "==> Rebasing $BRANCH onto main ..."
git checkout "$BRANCH"
if git rebase "$MAIN"; then
    echo "==> Rebase succeeded"
else
    echo "==> Rebase failed. Resolve conflicts, then run:"
    echo "    git rebase --continue"
    echo "After resolving, rerun this script or run the build step manually."
    exit 1
fi

echo "==> Re-applying AccessiMind i18n/chat merge fixes ..."
python3 "$REPO/remote_merge.py"

echo "==> Rebuilding web UI ..."
cd "$REPO/web"
npm ci
npm run build

echo "==> Restarting dashboard ..."
systemctl restart hermes-dashboard

echo "==> Done. Branch $BRANCH is now on top of upstream $MAIN."
