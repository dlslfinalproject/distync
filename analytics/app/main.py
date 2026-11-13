from fastapi import FastAPI

from .forecasting.routes import router as forecasting_router

app = FastAPI(title="DISTYNC Analytics Service")

app.include_router(forecasting_router)


@app.get("/health")
def health():
    return {"status": "online", "service": "analytics"}


@app.get("/")
def root():
    return {"message": "DISTYNC Analytics Service is running."}
