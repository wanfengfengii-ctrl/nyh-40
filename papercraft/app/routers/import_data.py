from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import PulpBatch, PulpComponent
from app.schemas import ImportRecord, ImportResult, PulpComponentCreate

router = APIRouter(prefix="/import", tags=["数据导入"])


@router.post("/", response_model=ImportResult)
def import_batches(records: List[ImportRecord], db: Session = Depends(get_db)):
    imported = 0
    skipped = 0
    errors = []

    for i, record in enumerate(records):
        if not record.batch_no or not record.batch_no.strip():
            errors.append(f"第 {i + 1} 条记录：批次编号不能为空")
            skipped += 1
            continue

        existing = db.query(PulpBatch).filter(PulpBatch.batch_no == record.batch_no).first()
        if existing:
            errors.append(f"第 {i + 1} 条记录：批次编号 '{record.batch_no}' 已存在，跳过以防止覆盖当前记录")
            skipped += 1
            continue

        valid_components = True
        for j, comp in enumerate(record.components):
            if comp.ratio < 0:
                errors.append(f"第 {i + 1} 条记录的第 {j + 1} 个成分：配比不能为负数")
                valid_components = False
                break

        if not valid_components:
            skipped += 1
            continue

        batch = PulpBatch(batch_no=record.batch_no, notes=record.notes)
        db.add(batch)
        db.flush()

        for comp_data in record.components:
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

        imported += 1

    db.commit()
    return ImportResult(imported=imported, skipped=skipped, errors=errors)
