#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
ENV_FILE="$PROJECT_ROOT/.env"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  echo "Please create it based on .env.example"
  exit 1
fi

source "$ENV_FILE"

if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
  echo "Error: Missing required environment variables in .env file"
  echo "Required: DEPLOY_HOST, DEPLOY_USER, DEPLOY_PATH"
  exit 1
fi

echo "Building project..."
cd "$PROJECT_ROOT"
pnpm build

if [ ! -d "$PROJECT_ROOT/dist" ]; then
  echo "Error: Build failed - dist directory not found"
  exit 1
fi

echo "Verifying remote directory exists..."
if ! ssh -o StrictHostKeyChecking=no "$DEPLOY_USER@$DEPLOY_HOST" "test -d $DEPLOY_PATH"; then
  echo "Error: Remote directory $DEPLOY_PATH does not exist on $DEPLOY_HOST"
  echo "Please create it manually on the server first"
  exit 1
fi

echo "Syncing files to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH..."
rsync -avz --delete -e "ssh -o StrictHostKeyChecking=no" "$PROJECT_ROOT/dist/" "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH/"

echo "Deployment complete!"

