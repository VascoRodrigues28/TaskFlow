from fastapi import FastAPI

from routers.tasks import router as tasks_router

app = FastAPI(title="TaskFlow API")
app.include_router(tasks_router)


@app.get("/")
def read_root() -> dict[str, str]:
    return {"message": "TaskFlow API está a funcionar!"}
