from fastapi import FastAPI
import os

app = FastAPI(title="HaCha AI Service")

@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "hacha-ai-service",
        "environment": os.getenv("ENVIRONMENT", "development")
    }
