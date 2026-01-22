from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.routers import projects, api_keys, agents, chat, model_profiles

app = FastAPI(
    title="Prompt Management API",
    description="API for managing AI prompts and agents with versioning",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
origins = settings.cors_origins.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(projects.router, prefix="/api")
app.include_router(api_keys.router, prefix="/api")
app.include_router(agents.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(model_profiles.router, prefix="/api")

@app.get("/")
async def root():
    return {
        "message": "Prompt Management API",
        "version": "1.0.0",
        "docs": "/docs"
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug
    )
