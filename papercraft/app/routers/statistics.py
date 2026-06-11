from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any

from app.database import get_db
from app.models import (
    PulpBatch, PulpComponent, FiberSource, SizingAgent, MineralFiller,
    VatConcentration, PapermakingRecord, PaperObservation,
)
from app.schemas import (
    BatchComparison, BatchTraceOut, MaterialProportionItem,
    MaterialProportionStat, ExperimentSummary,
)

router = APIRouter(prefix="/statistics", tags=["统计分析"])


@router.post("/compare", response_model=List[BatchTraceOut])
def compare_batches(data: BatchComparison, db: Session = Depends(get_db)):
    batches = db.query(PulpBatch).filter(PulpBatch.id.in_(data.batch_ids)).all()
    if len(batches) != len(data.batch_ids):
        found_ids = {b.id for b in batches}
        missing = [i for i in data.batch_ids if i not in found_ids]
        raise HTTPException(status_code=404, detail=f"以下批次不存在: {missing}")

    results = []
    for batch in batches:
        concentrations = db.query(VatConcentration).filter(VatConcentration.batch_id == batch.id).all()
        records = db.query(PapermakingRecord).filter(PapermakingRecord.batch_id == batch.id).all()
        results.append(BatchTraceOut(
            batch=batch,
            concentrations=concentrations,
            papermaking_records=records,
        ))
    return results


@router.get("/trace/{batch_id}", response_model=BatchTraceOut)
def trace_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    concentrations = db.query(VatConcentration).filter(VatConcentration.batch_id == batch_id).all()
    records = db.query(PapermakingRecord).filter(PapermakingRecord.batch_id == batch_id).all()
    return BatchTraceOut(
        batch=batch,
        concentrations=concentrations,
        papermaking_records=records,
    )


@router.get("/material-proportion", response_model=MaterialProportionStat)
def material_proportion_statistics(db: Session = Depends(get_db)):
    visible_batches = db.query(PulpBatch).filter(PulpBatch.hidden == False).all()
    visible_batch_ids = [b.id for b in visible_batches]

    if not visible_batch_ids:
        return MaterialProportionStat(batch_count=0, total_ratio_sum=0, items=[])

    components = db.query(PulpComponent).filter(PulpComponent.batch_id.in_(visible_batch_ids)).all()

    material_map: Dict[str, Dict[int, float]] = {}
    for comp in components:
        key = comp.material_type
        mat_id = comp.fiber_source_id or comp.sizing_agent_id or comp.mineral_filler_id
        if mat_id is None:
            continue
        if key not in material_map:
            material_map[key] = {}
        if mat_id not in material_map[key]:
            material_map[key][mat_id] = 0
        material_map[key][mat_id] += comp.ratio

    items = []
    total_ratio_sum = 0.0
    for mat_type, mat_dict in material_map.items():
        for mat_id, total_ratio in mat_dict.items():
            total_ratio_sum += total_ratio

    for mat_type, mat_dict in material_map.items():
        for mat_id, total_ratio in mat_dict.items():
            name = _get_material_name(db, mat_type, mat_id)
            items.append(MaterialProportionItem(
                material_type=mat_type,
                material_id=mat_id,
                material_name=name,
                total_ratio=total_ratio,
                ratio_percentage=round(total_ratio / total_ratio_sum * 100, 2) if total_ratio_sum > 0 else 0,
            ))

    return MaterialProportionStat(
        batch_count=len(visible_batches),
        total_ratio_sum=total_ratio_sum,
        items=items,
    )


def _get_material_name(db: Session, material_type: str, material_id: int) -> str:
    if material_type == "fiber":
        obj = db.query(FiberSource).filter(FiberSource.id == material_id).first()
        return obj.name if obj else f"纤维#{material_id}"
    elif material_type == "sizing":
        obj = db.query(SizingAgent).filter(SizingAgent.id == material_id).first()
        return obj.name if obj else f"胶料#{material_id}"
    elif material_type == "filler":
        obj = db.query(MineralFiller).filter(MineralFiller.id == material_id).first()
        return obj.name if obj else f"填料#{material_id}"
    return f"未知#{material_id}"


@router.get("/summary", response_model=ExperimentSummary)
def experiment_summary(db: Session = Depends(get_db)):
    all_batches = db.query(PulpBatch).all()
    visible_batches = [b for b in all_batches if not b.hidden]
    sealed_batches = [b for b in all_batches if b.is_sealed]
    visible_ids = [b.id for b in visible_batches]
    all_ids = [b.id for b in all_batches]

    total_records = db.query(PapermakingRecord).filter(PapermakingRecord.batch_id.in_(all_ids)).count()
    total_observations = (
        db.query(PaperObservation)
        .join(PapermakingRecord)
        .filter(PapermakingRecord.batch_id.in_(all_ids))
        .count()
    )

    ratings = (
        db.query(PaperObservation.overall_rating)
        .join(PapermakingRecord)
        .filter(PapermakingRecord.batch_id.in_(visible_ids), PaperObservation.overall_rating.isnot(None))
        .all()
    )
    avg_rating = round(sum(r[0] for r in ratings) / len(ratings), 2) if ratings else None

    visible_components = db.query(PulpComponent).filter(PulpComponent.batch_id.in_(visible_ids)).all()

    fiber_dist: Dict[str, Any] = {}
    sizing_dist: Dict[str, Any] = {}
    filler_dist: Dict[str, Any] = {}

    for comp in visible_components:
        if comp.material_type == "fiber" and comp.fiber_source_id:
            name = _get_material_name(db, "fiber", comp.fiber_source_id)
            fiber_dist[name] = fiber_dist.get(name, 0) + comp.ratio
        elif comp.material_type == "sizing" and comp.sizing_agent_id:
            name = _get_material_name(db, "sizing", comp.sizing_agent_id)
            sizing_dist[name] = sizing_dist.get(name, 0) + comp.ratio
        elif comp.material_type == "filler" and comp.mineral_filler_id:
            name = _get_material_name(db, "filler", comp.mineral_filler_id)
            filler_dist[name] = filler_dist.get(name, 0) + comp.ratio

    concentrations = db.query(VatConcentration).filter(VatConcentration.batch_id.in_(visible_ids)).all()
    conc_values = [c.concentration for c in concentrations]
    concentration_stats = {
        "count": len(conc_values),
        "min": min(conc_values) if conc_values else None,
        "max": max(conc_values) if conc_values else None,
        "avg": round(sum(conc_values) / len(conc_values), 4) if conc_values else None,
    }

    date_range = None
    if visible_ids:
        records_with_dates = (
            db.query(PapermakingRecord.paper_date)
            .filter(PapermakingRecord.batch_id.in_(visible_ids))
            .order_by(PapermakingRecord.paper_date)
            .all()
        )
        if records_with_dates:
            date_range = {
                "earliest": records_with_dates[0][0].isoformat(),
                "latest": records_with_dates[-1][0].isoformat(),
            }

    return ExperimentSummary(
        total_batches=len(all_batches),
        visible_batches=len(visible_batches),
        sealed_batches=len(sealed_batches),
        total_papermaking_records=total_records,
        total_observations=total_observations,
        avg_overall_rating=avg_rating,
        fiber_distribution=fiber_dist,
        sizing_distribution=sizing_dist,
        filler_distribution=filler_dist,
        concentration_stats=concentration_stats,
        date_range=date_range,
    )
