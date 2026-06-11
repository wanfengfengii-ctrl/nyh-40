from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.routers import fibers, batches, records, statistics, import_data, templates, images

app = FastAPI(
    title="纸坊配浆抄纸实验记录系统",
    description="用于纸坊研究人员记录不同纤维、胶料、矿物填料在古法抄纸中的配浆轮次和成纸表现。支持实验方案模板管理、一键复刻批次、智能推荐历史方案。",
    version="1.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fibers.router)
app.include_router(fibers.sizing_router)
app.include_router(fibers.filler_router)
app.include_router(batches.router)
app.include_router(records.router)
app.include_router(statistics.router)
app.include_router(import_data.router)
app.include_router(templates.router)
app.include_router(images.router)

app.mount("/static", StaticFiles(directory="frontend"), name="static")


@app.on_event("startup")
def startup():
    init_db()


@app.get("/", tags=["系统"])
def root():
    return {"message": "纸坊配浆抄纸实验记录系统", "docs": "/docs"}
