#!/usr/bin/env bash
set -euo pipefail

echo "Checking BYBS LMS staging..."

curl -fsS https://api.lms.buildyourbestself.org/health
echo
curl -fsS https://api.lms.buildyourbestself.org/ready
echo
curl -fsSI https://lms.buildyourbestself.org | head -n 1
curl -fsSI https://admin.lms.buildyourbestself.org | head -n 1
curl -fsSI https://mentor.lms.buildyourbestself.org | head -n 1

echo "Staging checks completed."
