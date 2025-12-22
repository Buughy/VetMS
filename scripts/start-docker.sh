#!/bin/bash

# VetMS Docker Starter

set -e
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Starting VetMS with Docker..."
cd "$PROJECT_DIR"

if ! command -v docker &> /dev/null; then
    echo "Error: docker could not be found."
    exit 1
fi

# Run docker compose
docker compose up --build
