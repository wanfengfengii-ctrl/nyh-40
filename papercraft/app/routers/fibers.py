from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import FiberSource, SizingAgent, MineralFiller
from app.schemas import (
    FiberSourceCreate, FiberSourceUpdate, FiberSourceOut,
    SizingAgentCreate, SizingAgentUpdate, SizingAgentOut,
    MineralFillerCreate, MineralFillerUpdate, MineralFillerOut,
)

router = APIRouter(prefix="/fibers", tags=["纤维来源"])


@router.post("/", response_model=FiberSourceOut, status_code=201)
def create_fiber_source(data: FiberSourceCreate, db: Session = Depends(get_db)):
    obj = FiberSource(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/", response_model=List[FiberSourceOut])
def list_fiber_sources(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(FiberSource).offset(skip).limit(limit).all()


@router.get("/{fiber_id}", response_model=FiberSourceOut)
def get_fiber_source(fiber_id: int, db: Session = Depends(get_db)):
    obj = db.query(FiberSource).filter(FiberSource.id == fiber_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="纤维来源不存在")
    return obj


@router.put("/{fiber_id}", response_model=FiberSourceOut)
def update_fiber_source(fiber_id: int, data: FiberSourceUpdate, db: Session = Depends(get_db)):
    obj = db.query(FiberSource).filter(FiberSource.id == fiber_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="纤维来源不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@router.delete("/{fiber_id}", status_code=204)
def delete_fiber_source(fiber_id: int, db: Session = Depends(get_db)):
    obj = db.query(FiberSource).filter(FiberSource.id == fiber_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="纤维来源不存在")
    db.delete(obj)
    db.commit()


sizing_router = APIRouter(prefix="/sizing-agents", tags=["胶料"])


@sizing_router.post("/", response_model=SizingAgentOut, status_code=201)
def create_sizing_agent(data: SizingAgentCreate, db: Session = Depends(get_db)):
    obj = SizingAgent(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@sizing_router.get("/", response_model=List[SizingAgentOut])
def list_sizing_agents(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(SizingAgent).offset(skip).limit(limit).all()


@sizing_router.get("/{agent_id}", response_model=SizingAgentOut)
def get_sizing_agent(agent_id: int, db: Session = Depends(get_db)):
    obj = db.query(SizingAgent).filter(SizingAgent.id == agent_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="胶料不存在")
    return obj


@sizing_router.put("/{agent_id}", response_model=SizingAgentOut)
def update_sizing_agent(agent_id: int, data: SizingAgentUpdate, db: Session = Depends(get_db)):
    obj = db.query(SizingAgent).filter(SizingAgent.id == agent_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="胶料不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@sizing_router.delete("/{agent_id}", status_code=204)
def delete_sizing_agent(agent_id: int, db: Session = Depends(get_db)):
    obj = db.query(SizingAgent).filter(SizingAgent.id == agent_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="胶料不存在")
    db.delete(obj)
    db.commit()


filler_router = APIRouter(prefix="/mineral-fillers", tags=["矿物填料"])


@filler_router.post("/", response_model=MineralFillerOut, status_code=201)
def create_mineral_filler(data: MineralFillerCreate, db: Session = Depends(get_db)):
    obj = MineralFiller(**data.model_dump())
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@filler_router.get("/", response_model=List[MineralFillerOut])
def list_mineral_fillers(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(MineralFiller).offset(skip).limit(limit).all()


@filler_router.get("/{filler_id}", response_model=MineralFillerOut)
def get_mineral_filler(filler_id: int, db: Session = Depends(get_db)):
    obj = db.query(MineralFiller).filter(MineralFiller.id == filler_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="矿物填料不存在")
    return obj


@filler_router.put("/{filler_id}", response_model=MineralFillerOut)
def update_mineral_filler(filler_id: int, data: MineralFillerUpdate, db: Session = Depends(get_db)):
    obj = db.query(MineralFiller).filter(MineralFiller.id == filler_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="矿物填料不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obj, key, value)
    db.commit()
    db.refresh(obj)
    return obj


@filler_router.delete("/{filler_id}", status_code=204)
def delete_mineral_filler(filler_id: int, db: Session = Depends(get_db)):
    obj = db.query(MineralFiller).filter(MineralFiller.id == filler_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="矿物填料不存在")
    db.delete(obj)
    db.commit()
