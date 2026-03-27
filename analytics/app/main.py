from fastapi import FastAPI

app = FastAPI(title="DISTYNC Analytics Service")

@app.get("/")
def root():
    return {"message": "DISTYNC Analytics Service is running."}