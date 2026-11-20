from os import getenv
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from routers.auth import router as auth_router
from routers.notifications import router as notifications_router
from routers.projects import router as projects_router
from routers.tasks import router as tasks_router

load_dotenv(Path(__file__).with_name(".env"))

app = FastAPI(title="TaskFlow API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in getenv(
            "CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000"
        ).split(",")
        if origin.strip()
    ],
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
app.include_router(auth_router)
app.include_router(notifications_router)
app.include_router(projects_router)
app.include_router(tasks_router)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(request: Request, error: RequestValidationError) -> JSONResponse:
    if request.url.path.startswith("/auth/"):
        details = [
            {key: issue[key] for key in ("loc", "msg", "type")}
            for issue in error.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": details})

    return await request_validation_exception_handler(request, error)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "TaskFlow API está a funcionar!"}
