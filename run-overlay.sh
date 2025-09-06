#!/bin/bash
set -e

# Run this from the overlay directory.

cleanup() {
  docker compose \
    --env-file "$(pwd)/.env" \
    -f "$(pwd)/../yaml-project-manager/docker-compose.yml" down
}
trap cleanup INT TERM EXIT

docker compose \
  --env-file "$(pwd)/.env" \
  -f "$(pwd)/../yaml-project-manager/docker-compose.yml" up
