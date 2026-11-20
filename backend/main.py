from os import getenv
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

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
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type"],
)
app.include_router(tasks_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "TaskFlow API está a funcionar!"}
