#!/bin/bash
# Server deployment script for ilsangkit
# Usage: ./scripts/deploy.sh

set -e

PROJECT_DIR="/home/project2"
LOG_DIR="$PROJECT_DIR/logs"

echo "=== Starting deployment ==="
echo "Time: $(date)"

# Create logs directory if not exists
mkdir -p $LOG_DIR

# Navigate to project directory
cd $PROJECT_DIR

# Pull latest changes
echo ">>> Pulling latest changes from git..."
git fetch origin main
git reset --hard origin/main

# Backend deployment
echo ">>> Building backend..."
cd $PROJECT_DIR/backend
npm ci --production=false
npm run build
npm run db:migrate

# Frontend deployment
echo ">>> Building frontend..."
cd $PROJECT_DIR/frontend
npm ci --production=false
npm run build

# Restart PM2 processes
echo ">>> Restarting PM2 processes..."
cd $PROJECT_DIR
pm2 reload ecosystem.config.js --env production

# Verify deployment
echo ">>> Verifying deployment..."
pm2 list

echo "=== Deployment completed ==="
echo "Time: $(date)"
