from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import PulpBatch, PulpComponent, PaperObservation, PapermakingRecord, VatConcentration
from app.schemas import (
    PulpBatchCreate, PulpBatchUpdate, PulpBatchOut,
    PulpComponentCreate, PulpComponentOut,
    VatConcentrationCreate, VatConcentrationOut,
    BatchDeleteConfirm,
)

router = APIRouter(prefix="/batches", tags=["配浆批次"])


@router.post("/", response_model=PulpBatchOut, status_code=201)
def create_batch(data: PulpBatchCreate, db: Session = Depends(get_db)):
    existing = db.query(PulpBatch).filter(PulpBatch.batch_no == data.batch_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"批次编号 '{data.batch_no}' 已存在，不能重复")

    batch = PulpBatch(batch_no=data.batch_no, notes=data.notes)
    db.add(batch)
    db.flush()

    for comp_data in data.components:
        comp = PulpComponent(
            batch_id=batch.id,
            material_type=comp_data.material_type.value,
            fiber_source_id=comp_data.fiber_source_id,
            sizing_agent_id=comp_data.sizing_agent_id,
            mineral_filler_id=comp_data.mineral_filler_id,
            ratio=comp_data.ratio,
            notes=comp_data.notes,
        )
        db.add(comp)

    db.commit()
    db.refresh(batch)
    return batch


@router.get("/", response_model=List[PulpBatchOut])
def list_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(PulpBatch).offset(skip).limit(limit).all()


@router.get("/{batch_id}", response_model=PulpBatchOut)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    return batch


@router.put("/{batch_id}", response_model=PulpBatchOut)
def update_batch(batch_id: int, data: PulpBatchUpdate, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    if data.batch_no is not None and data.batch_no != batch.batch_no:
        existing = db.query(PulpBatch).filter(PulpBatch.batch_no == data.batch_no).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"批次编号 '{data.batch_no}' 已存在，不能重复")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(batch, key, value)

    db.commit()
    db.refresh(batch)
    return batch


@router.delete("/{batch_id}", status_code=204)
def delete_batch(batch_id: int, confirmed: bool = False, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    has_observations = (
        db.query(PaperObservation)
        .join(PapermakingRecord)
        .filter(PapermakingRecord.batch_id == batch_id)
        .first()
    )
    if has_observations and not confirmed:
        raise HTTPException(
            status_code=409,
            detail="该批次已有关联的成纸观察记录，删除前必须二次确认。请设置 confirmed=true 参数确认删除。",
        )

    db.delete(batch)
    db.commit()


@router.post("/{batch_id}/seal", response_model=PulpBatchOut)
def seal_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    batch.is_sealed = True
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{batch_id}/unseal", response_model=PulpBatchOut)
def unseal_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    batch.is_sealed = False
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{batch_id}/toggle-hidden", response_model=PulpBatchOut)
def toggle_hidden(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    batch.hidden = not batch.hidden
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/{batch_id}/components", response_model=PulpComponentOut, status_code=201)
def add_component(batch_id: int, data: PulpComponentCreate, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    if batch.is_sealed:
        raise HTTPException(status_code=400, detail="已封存批次不能再修改配浆成分")

    comp = PulpComponent(
        batch_id=batch_id,
        material_type=data.material_type.value,
        fiber_source_id=data.fiber_source_id,
        sizing_agent_id=data.sizing_agent_id,
        mineral_filler_id=data.mineral_filler_id,
        ratio=data.ratio,
        notes=data.notes,
    )
    db.add(comp)
    db.commit()
    db.refresh(comp)
    return comp


@router.put("/{batch_id}/components/{comp_id}", response_model=PulpComponentOut)
def update_component(batch_id: int, comp_id: int, data: PulpComponentCreate, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    if batch.is_sealed:
        raise HTTPException(status_code=400, detail="已封存批次不能再修改配浆成分")

    comp = db.query(PulpComponent).filter(PulpComponent.id == comp_id, PulpComponent.batch_id == batch_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="配浆成分不存在")

    comp.material_type = data.material_type.value
    comp.fiber_source_id = data.fiber_source_id
    comp.sizing_agent_id = data.sizing_agent_id
    comp.mineral_filler_id = data.mineral_filler_id
    comp.ratio = data.ratio
    comp.notes = data.notes
    db.commit()
    db.refresh(comp)
    return comp


@router.delete("/{batch_id}/components/{comp_id}", status_code=204)
def delete_component(batch_id: int, comp_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")
    if batch.is_sealed:
        raise HTTPException(status_code=400, detail="已封存批次不能再修改配浆成分")

    comp = db.query(PulpComponent).filter(PulpComponent.id == comp_id, PulpComponent.batch_id == batch_id).first()
    if not comp:
        raise HTTPException(status_code=404, detail="配浆成分不存在")
    db.delete(comp)
    db.commit()


@router.post("/{batch_id}/concentrations", response_model=VatConcentrationOut, status_code=201)
def add_concentration(batch_id: int, data: VatConcentrationCreate, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    conc = VatConcentration(batch_id=batch_id, concentration=data.concentration, notes=data.notes)
    db.add(conc)
    db.commit()
    db.refresh(conc)
    return conc


@router.get("/{batch_id}/concentrations", response_model=List[VatConcentrationOut])
def list_concentrations(batch_id: int, db: Session = Depends(get_db)):
    return db.query(VatConcentration).filter(VatConcentration.batch_id == batch_id).all()
