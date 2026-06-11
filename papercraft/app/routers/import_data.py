from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.models import PulpBatch, PulpComponent
from app.schemas import ImportRecord, ImportResult

router = APIRouter(prefix="/import", tags=["数据导入"])

VALID_MATERIAL_TYPES = {"fiber", "sizing", "filler"}


def _validate_record(i: int, record: ImportRecord, errors: List[str]) -> bool:
    is_valid = True

    if not record.batch_no or not record.batch_no.strip():
        errors.append(f"第 {i + 1} 条记录：批次编号不能为空")
        return False

    for j, comp in enumerate(record.components):
        prefix = f"第 {i + 1} 条记录的第 {j + 1} 个成分"

        if comp.material_type not in VALID_MATERIAL_TYPES:
            errors.append(f"{prefix}：材料类型无效（必须是 fiber/sizing/filler 之一）")
            is_valid = False
            continue

        if comp.ratio is None:
            errors.append(f"{prefix}：缺少配比值")
            is_valid = False
            continue

        if comp.ratio < 0:
            errors.append(f"{prefix}：配比不能为负数")
            is_valid = False
            continue

        if comp.material_type == "fiber" and comp.fiber_source_id is None:
            errors.append(f"{prefix}：纤维类型成分必须指定 fiber_source_id")
            is_valid = False
        elif comp.material_type == "sizing" and comp.sizing_agent_id is None:
            errors.append(f"{prefix}：胶料类型成分必须指定 sizing_agent_id")
            is_valid = False
        elif comp.material_type == "filler" and comp.mineral_filler_id is None:
            errors.append(f"{prefix}：填料类型成分必须指定 mineral_filler_id")
            is_valid = False

    return is_valid


@router.post("/", response_model=ImportResult)
def import_batches(records: List[ImportRecord], db: Session = Depends(get_db)):
    imported = 0
    skipped = 0
    errors = []

    for i, record in enumerate(records):
        if not _validate_record(i, record, errors):
            skipped += 1
            continue

        existing = db.query(PulpBatch).filter(PulpBatch.batch_no == record.batch_no).first()
        if existing:
            errors.append(f"第 {i + 1} 条记录：批次编号 '{record.batch_no}' 已存在，跳过以防止覆盖当前记录")
            skipped += 1
            continue

        batch = PulpBatch(batch_no=record.batch_no, notes=record.notes)
        db.add(batch)
        db.flush()

        for comp_data in record.components:
            comp = PulpComponent(
                batch_id=batch.id,
                material_type=comp_data.material_type,
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
