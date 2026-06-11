from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import PapermakingRecord, PaperObservation, PulpBatch
from app.schemas import (
    PapermakingRecordCreate, PapermakingRecordUpdate, PapermakingRecordOut,
    PaperObservationCreate, PaperObservationUpdate, PaperObservationOut,
)

router = APIRouter(prefix="/records", tags=["抄纸记录与成纸观察"])


@router.post("/{batch_id}/papermaking", response_model=PapermakingRecordOut, status_code=201)
def create_papermaking_record(batch_id: int, data: PapermakingRecordCreate, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    record = PapermakingRecord(
        batch_id=batch_id,
        paper_date=data.paper_date,
        operator=data.operator,
        notes=data.notes,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.get("/papermaking", response_model=List[PapermakingRecordOut])
def list_papermaking_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(PapermakingRecord).offset(skip).limit(limit).all()


@router.get("/{batch_id}/papermaking", response_model=List[PapermakingRecordOut])
def list_batch_papermaking_records(batch_id: int, db: Session = Depends(get_db)):
    return db.query(PapermakingRecord).filter(PapermakingRecord.batch_id == batch_id).all()


@router.get("/papermaking/{record_id}", response_model=PapermakingRecordOut)
def get_papermaking_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(PapermakingRecord).filter(PapermakingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="抄纸记录不存在")
    return record


@router.put("/papermaking/{record_id}", response_model=PapermakingRecordOut)
def update_papermaking_record(record_id: int, data: PapermakingRecordUpdate, db: Session = Depends(get_db)):
    record = db.query(PapermakingRecord).filter(PapermakingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="抄纸记录不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/papermaking/{record_id}", status_code=204)
def delete_papermaking_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(PapermakingRecord).filter(PapermakingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="抄纸记录不存在")
    db.delete(record)
    db.commit()


@router.post("/papermaking/{record_id}/observations", response_model=PaperObservationOut, status_code=201)
def create_observation(record_id: int, data: PaperObservationCreate, db: Session = Depends(get_db)):
    record = db.query(PapermakingRecord).filter(PapermakingRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="抄纸记录不存在")

    obs = PaperObservation(
        record_id=record_id,
        thickness=data.thickness,
        tensile_strength=data.tensile_strength,
        absorbency=data.absorbency,
        color=data.color,
        texture=data.texture,
        overall_rating=data.overall_rating,
        notes=data.notes,
    )
    db.add(obs)
    db.commit()
    db.refresh(obs)
    return obs


@router.get("/papermaking/{record_id}/observations", response_model=List[PaperObservationOut])
def list_observations(record_id: int, db: Session = Depends(get_db)):
    return db.query(PaperObservation).filter(PaperObservation.record_id == record_id).all()


@router.get("/observations/{obs_id}", response_model=PaperObservationOut)
def get_observation(obs_id: int, db: Session = Depends(get_db)):
    obs = db.query(PaperObservation).filter(PaperObservation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="成纸观察不存在")
    return obs


@router.put("/observations/{obs_id}", response_model=PaperObservationOut)
def update_observation(obs_id: int, data: PaperObservationUpdate, db: Session = Depends(get_db)):
    obs = db.query(PaperObservation).filter(PaperObservation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="成纸观察不存在")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(obs, key, value)
    db.commit()
    db.refresh(obs)
    return obs


@router.delete("/observations/{obs_id}", status_code=204)
def delete_observation(obs_id: int, db: Session = Depends(get_db)):
    obs = db.query(PaperObservation).filter(PaperObservation.id == obs_id).first()
    if not obs:
        raise HTTPException(status_code=404, detail="成纸观察不存在")
    db.delete(obs)
    db.commit()
