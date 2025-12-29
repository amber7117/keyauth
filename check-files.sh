#!/bin/bash
echo "=== Checking Git tracked files in database/ ==="
git ls-files database/

echo ""
echo "=== Checking actual files in database/ ==="
ls -la database/

echo ""
echo "=== Checking .gitignore rules ==="
git check-ignore -v database/db.js || echo "database/db.js is NOT ignored"
