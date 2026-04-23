# Tricia Monitoring App

Monitoring web application with FastAPI backend and Vite React TypeScript frontend.

## Development

- Backend: `PYTHONPATH=backend .venv/bin/python -m uvicorn src.main:app --reload`
- Frontend: `cd frontend && npm run dev`
- Backend tests: `PYTHONPATH=backend .venv/bin/python -m pytest backend/tests -q`
- Frontend tests: `cd frontend && npm run test`

## Deployment

Azure Container Apps manifests are in `infra/aca/` and deployment workflow is `.github/workflows/deploy-aca.yml`.
