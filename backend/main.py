from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from config import settings
from api import analysis

app = FastAPI(title=settings.app_name, debug=settings.debug)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # Vite dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(analysis.router, prefix="/api", tags=["analysis"])

@app.get("/")
def root():
    return {"message": "SC2 Replay Analyzer API", "status": "running"}

@app.get("/health")
def health_check():
    return {"status": "healthy"}
