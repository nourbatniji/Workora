#!/usr/bin/env bash
# SCRUM-168 / api-conventions.md §8: raw SQL skips company isolation,
# so it is not allowed in apps/api/src outside src/prisma/.
set -euo pipefail

if grep -rnE '\$(queryRaw|executeRaw)' apps/api/src \
  --exclude-dir=prisma --exclude-dir=generated; then
  echo "✗ Raw SQL found (lines above). Use TenantPrismaService.db with normal Prisma queries."
  exit 1
fi

echo "✓ No raw SQL in apps/api/src"
