#!/usr/bin/env bash
# Idempotent bootstrap for the HeyMaa dev environment.
# Installs backend (Python) and frontend/admin (Node) dependencies from lockfiles.
set -euo pipefail

cd "$(dirname "$0")/.."

# uv is the project's Python package manager (see uv.lock / pyproject.toml).
if ! command -v uv >/dev/null 2>&1; then
  curl -LsSf https://astral.sh/uv/install.sh | sh
fi
export PATH="$HOME/.local/bin:$PATH"

# Backend: create .venv and install the locked Python dependencies.
uv sync --frozen

# Frontend + admin: install Node dependencies from their lockfiles.
npm ci --prefix frontend --no-audit --no-fund
npm ci --prefix admin --no-audit --no-fund
