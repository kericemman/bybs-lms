#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/bybs-lms}"
DEPLOY_BRANCH="${DEPLOY_BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-bybs-lms-api}"

echo "Deploying BYBS LMS..."
echo "App directory: ${APP_DIR}"
echo "Branch: origin/${DEPLOY_BRANCH}"

cd "${APP_DIR}"

if ! git config --global --get-all safe.directory | grep -Fxq "${APP_DIR}"; then
  git config --global --add safe.directory "${APP_DIR}"
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Deployment stopped: ${APP_DIR} has local uncommitted changes."
  echo "Commit, stash, or manually review these changes on the VPS before deploying:"
  git status --short
  exit 1
fi

git fetch origin "${DEPLOY_BRANCH}"
git checkout "${DEPLOY_BRANCH}"
git pull --ff-only origin "${DEPLOY_BRANCH}"

npm ci
npm run build

sudo systemctl restart "${SERVICE_NAME}"
sleep 3
sudo systemctl status "${SERVICE_NAME}" --no-pager --lines=30

bash deploy/hostinger/check-staging.sh

echo "BYBS LMS deployment completed successfully."
