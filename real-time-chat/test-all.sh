#!/bin/bash
set -e

echo "=== Testing Backend ==="
cd backend
npm run lint
npm run test -- --run
cd ..

echo "=== Testing Frontend ==="
cd frontend
npm run lint
npm run test -- --run
npm run build
cd ..

echo "All tests passed successfully!"
