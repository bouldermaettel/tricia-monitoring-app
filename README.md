# Tricia Monitoring App

Monitoring web application with FastAPI backend and Vite React TypeScript frontend.

## Development

- Backend: `PYTHONPATH=backend .venv/bin/python -m uvicorn src.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Backend tests: `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q`
- Frontend tests: `cd frontend && npm run test`

### Restart backend after auth/security changes

1. Stop running backend process (for example: `pkill -f "uvicorn src.main:app"`).
2. Start backend again: `PYTHONPATH=backend .venv/bin/python -m uvicorn src.main:app --reload`.
3. Verify backend is reachable: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/docs`.

Note: the repository currently has migration versions only and no Alembic `env.py` runner in `backend/src/db/migrations/`, so `alembic upgrade` is not usable until that runner is added.

## Deployment

Azure Container Apps manifests are in `infra/aca/` and deployment workflow is `.github/workflows/deploy-aca.yml`.
