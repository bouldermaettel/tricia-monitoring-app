from fastapi import APIRouter

from .routers import cases, matrices, control, imports, exports, config

api_router = APIRouter(prefix="/api/v1")
api_router.include_router(cases.router, prefix="/cases", tags=["cases"])
api_router.include_router(matrices.router, prefix="/matrices", tags=["matrices"])
api_router.include_router(control.router, prefix="/control", tags=["control"])
api_router.include_router(imports.router, prefix="/imports", tags=["imports"])
api_router.include_router(exports.router, prefix="/exports", tags=["exports"])
api_router.include_router(config.router, prefix="/config", tags=["config"])
