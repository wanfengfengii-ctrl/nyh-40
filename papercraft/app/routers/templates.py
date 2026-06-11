from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.models import (
    ExperimentTemplate, TemplateVersion, TemplateComponent, TemplateReplication,
    PulpBatch, PulpComponent, FiberSource, SizingAgent, MineralFiller,
    VatConcentration, PapermakingRecord, PaperObservation,
)
from app.schemas import (
    ExperimentTemplateCreate, ExperimentTemplateUpdate,
    ExperimentTemplateOut, ExperimentTemplateDetailOut,
    TemplateVersionCreate, TemplateVersionOut,
    TemplateComponentOut,
    TemplateReplicateBatch, TemplateReplicationOut,
    SchemeRecommendationRequest, RecommendedScheme,
    PulpComponentOut,
)

router = APIRouter(prefix="/templates", tags=["实验方案模板"])


def _get_material_name(db: Session, material_type: str, material_id: Optional[int]) -> Optional[str]:
    if material_id is None:
        return None
    if material_type == "fiber":
        obj = db.query(FiberSource).filter(FiberSource.id == material_id).first()
        return obj.name if obj else None
    elif material_type == "sizing":
        obj = db.query(SizingAgent).filter(SizingAgent.id == material_id).first()
        return obj.name if obj else None
    elif material_type == "filler":
        obj = db.query(MineralFiller).filter(MineralFiller.id == material_id).first()
        return obj.name if obj else None
    return None


def _enrich_component_with_name(db: Session, comp) -> TemplateComponentOut:
    out = TemplateComponentOut.model_validate(comp)
    out.material_name = _get_material_name(db, comp.material_type, out.fiber_source_id or out.sizing_agent_id or out.mineral_filler_id)
    return out


def _enrich_version_with_names(db: Session, version: TemplateVersion) -> TemplateVersionOut:
    out = TemplateVersionOut.model_validate(version)
    out.components = [_enrich_component_with_name(db, c) for c in version.components]
    return out


def _get_replication_count(db: Session, template_id: int) -> int:
    return db.query(TemplateReplication).filter(TemplateReplication.template_id == template_id).count()


@router.post("/", response_model=ExperimentTemplateDetailOut, status_code=201)
def create_template(data: ExperimentTemplateCreate, db: Session = Depends(get_db)):
    existing = db.query(ExperimentTemplate).filter(ExperimentTemplate.name == data.name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"模板名称 '{data.name}' 已存在")

    template = ExperimentTemplate(
        name=data.name,
        category=data.category,
        description=data.description,
        is_active=True,
    )
    db.add(template)
    db.flush()

    version = TemplateVersion(
        template_id=template.id,
        version=1,
        version_name=data.initial_version.version_name or "初始版本",
        change_notes=data.initial_version.change_notes,
        target_concentration=data.initial_version.target_concentration,
        notes=data.initial_version.notes,
    )
    db.add(version)
    db.flush()

    for comp_data in data.initial_version.components:
        comp = TemplateComponent(
            version_id=version.id,
            material_type=comp_data.material_type.value,
            fiber_source_id=comp_data.fiber_source_id,
            sizing_agent_id=comp_data.sizing_agent_id,
            mineral_filler_id=comp_data.mineral_filler_id,
            ratio=comp_data.ratio,
            notes=comp_data.notes,
        )
        db.add(comp)

    db.commit()
    db.refresh(template)

    result = ExperimentTemplateDetailOut.model_validate(template)
    result.versions = [_enrich_version_with_names(db, v) for v in template.versions]
    result.replication_count = 0
    return result


@router.get("/", response_model=List[ExperimentTemplateOut])
def list_templates(
    skip: int = 0,
    limit: int = 100,
    category: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ExperimentTemplate)
    if category:
        query = query.filter(ExperimentTemplate.category == category)
    if is_active is not None:
        query = query.filter(ExperimentTemplate.is_active == is_active)

    templates = query.order_by(ExperimentTemplate.updated_at.desc()).offset(skip).limit(limit).all()

    results = []
    for t in templates:
        out = ExperimentTemplateOut.model_validate(t)
        if t.latest_version:
            out.latest_version = _enrich_version_with_names(db, t.latest_version)
        out.replication_count = _get_replication_count(db, t.id)
        results.append(out)
    return results


@router.get("/categories", response_model=List[str])
def list_template_categories(db: Session = Depends(get_db)):
    categories = (
        db.query(ExperimentTemplate.category)
        .filter(ExperimentTemplate.category.isnot(None))
        .distinct()
        .all()
    )
    return [c[0] for c in categories if c[0]]


@router.post("/recommend", response_model=List[RecommendedScheme])
def recommend_schemes(request: SchemeRecommendationRequest, db: Session = Depends(get_db)):
    batches = (
        db.query(PulpBatch)
        .filter(PulpBatch.hidden == False)
        .all()
    )

    if not batches:
        return []

    batch_data = []
    for batch in batches:
        components = db.query(PulpComponent).filter(PulpComponent.batch_id == batch.id).all()

        conc_records = db.query(VatConcentration).filter(VatConcentration.batch_id == batch.id).all()
        avg_concentration = (
            sum(c.concentration for c in conc_records) / len(conc_records)
            if conc_records else None
        )

        observations = (
            db.query(PaperObservation)
            .join(PapermakingRecord)
            .filter(PapermakingRecord.batch_id == batch.id, PaperObservation.overall_rating.isnot(None))
            .all()
        )
        avg_rating = (
            sum(o.overall_rating for o in observations) / len(observations)
            if observations else None
        )

        batch_data.append({
            "batch": batch,
            "components": components,
            "avg_concentration": avg_concentration,
            "avg_rating": avg_rating,
        })

    scored = []
    for data in batch_data:
        score = 0.0
        reasons = []
        suggestions = []

        comps = data["components"]
        comp_map = {}
        for c in comps:
            key = c.material_type
            mat_id = c.fiber_source_id or c.sizing_agent_id or c.mineral_filler_id
            if key not in comp_map:
                comp_map[key] = []
            comp_map[key].append({"id": mat_id, "ratio": c.ratio})

        if request.target_rating is not None and data["avg_rating"] is not None:
            rating_diff = abs(data["avg_rating"] - request.target_rating)
            rating_score = max(0, 1 - rating_diff / 9)
            score += rating_score * 0.35
            if rating_diff <= 1:
                reasons.append(f"成纸评分 {data['avg_rating']:.1f} 与目标 {request.target_rating} 非常接近")
            elif rating_diff <= 2:
                reasons.append(f"成纸评分 {data['avg_rating']:.1f} 与目标 {request.target_rating} 较为接近")
            else:
                suggestions.append(f"成纸评分 {data['avg_rating']:.1f} 与目标 {request.target_rating} 有差距，可考虑调整配比")

        if request.target_concentration is not None and data["avg_concentration"] is not None:
            if request.target_concentration > 0:
                conc_diff_pct = abs(data["avg_concentration"] - request.target_concentration) / request.target_concentration
                conc_score = max(0, 1 - conc_diff_pct)
                score += conc_score * 0.25
                if conc_diff_pct <= 0.1:
                    reasons.append(f"槽液浓度 {data['avg_concentration']:.4f} 与目标 {request.target_concentration} 非常接近")
                elif conc_diff_pct <= 0.2:
                    reasons.append(f"槽液浓度 {data['avg_concentration']:.4f} 与目标 {request.target_concentration} 较为接近")
                else:
                    direction = "提高" if data["avg_concentration"] < request.target_concentration else "降低"
                    suggestions.append(f"槽液浓度偏{'低' if data['avg_concentration'] < request.target_concentration else '高'}，建议{direction}浓度")

        if request.fiber_preferences:
            fiber_ids = [item["id"] for item in comp_map.get("fiber", [])]
            matched = set(fiber_ids) & set(request.fiber_preferences)
            if matched:
                match_score = len(matched) / len(request.fiber_preferences)
                score += match_score * 0.25
                matched_names = [_get_material_name(db, "fiber", fid) for fid in matched]
                reasons.append(f"包含偏好纤维: {', '.join(n for n in matched_names if n)}")
            else:
                suggestions.append("未包含偏好的纤维种类，可考虑替换或添加")

        if data["avg_rating"] is not None:
            quality_score = data["avg_rating"] / 10
            score += quality_score * 0.15
            if data["avg_rating"] >= 8:
                reasons.append("历史成纸评分较高，配方成熟度好")

        fiber_count = len(comp_map.get("fiber", []))
        sizing_count = len(comp_map.get("sizing", []))
        filler_count = len(comp_map.get("filler", []))
        if fiber_count >= 2:
            score += 0.05
            reasons.append("纤维种类丰富，配方考虑因素较全面")
        if sizing_count >= 1:
            score += 0.03
        if filler_count >= 1:
            score += 0.02

        if not reasons and score > 0:
            reasons.append("综合多维度匹配，推荐参考")

        scored.append({
            "data": data,
            "score": score,
            "reasons": reasons,
            "suggestions": suggestions,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    top = scored[:request.top_k]

    results = []
    for item in top:
        data = item["data"]
        scheme = RecommendedScheme(
            batch_id=data["batch"].id,
            batch_no=data["batch"].batch_no,
            similarity_score=round(item["score"], 4),
            overall_rating=round(data["avg_rating"], 2) if data["avg_rating"] is not None else None,
            avg_concentration=round(data["avg_concentration"], 4) if data["avg_concentration"] is not None else None,
            components=[PulpComponentOut.model_validate(c) for c in data["components"]],
            recommendation_reasons=item["reasons"],
            adjustment_suggestions=item["suggestions"],
        )
        results.append(scheme)

    return results


@router.get("/versions/{version_id}", response_model=TemplateVersionOut)
def get_template_version(version_id: int, db: Session = Depends(get_db)):
    version = db.query(TemplateVersion).filter(TemplateVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="模板版本不存在")
    return _enrich_version_with_names(db, version)


@router.get("/replications/batch/{batch_id}", response_model=TemplateReplicationOut)
def get_batch_replication(batch_id: int, db: Session = Depends(get_db)):
    replication = db.query(TemplateReplication).filter(TemplateReplication.batch_id == batch_id).first()
    if not replication:
        raise HTTPException(status_code=404, detail="该批次无模板复刻记录")
    result = TemplateReplicationOut.model_validate(replication)
    result.batch_no = replication.batch.batch_no if replication.batch else None
    result.version_number = replication.version.version if replication.version else None
    return result


@router.post("/from-batch/{batch_id}", response_model=ExperimentTemplateDetailOut, status_code=201)
def create_template_from_batch(
    batch_id: int,
    name: str = Query(..., min_length=1, max_length=200),
    category: Optional[str] = Query(None, max_length=50),
    description: Optional[str] = None,
    db: Session = Depends(get_db),
):
    existing = db.query(ExperimentTemplate).filter(ExperimentTemplate.name == name).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"模板名称 '{name}' 已存在")

    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    components = db.query(PulpComponent).filter(PulpComponent.batch_id == batch_id).all()
    if not components:
        raise HTTPException(status_code=400, detail="该批次无配浆成分，无法创建模板")

    concs = db.query(VatConcentration).filter(VatConcentration.batch_id == batch_id).all()
    avg_conc = sum(c.concentration for c in concs) / len(concs) if concs else None

    template = ExperimentTemplate(
        name=name,
        category=category,
        description=description,
        is_active=True,
    )
    db.add(template)
    db.flush()

    version = TemplateVersion(
        template_id=template.id,
        version=1,
        version_name=f"源自 {batch.batch_no}",
        change_notes=f"从批次 {batch.batch_no} 创建",
        target_concentration=avg_conc,
        notes=batch.notes,
    )
    db.add(version)
    db.flush()

    for comp in components:
        tc = TemplateComponent(
            version_id=version.id,
            material_type=comp.material_type,
            fiber_source_id=comp.fiber_source_id,
            sizing_agent_id=comp.sizing_agent_id,
            mineral_filler_id=comp.mineral_filler_id,
            ratio=comp.ratio,
            notes=comp.notes,
        )
        db.add(tc)

    db.commit()
    db.refresh(template)

    result = ExperimentTemplateDetailOut.model_validate(template)
    result.versions = [_enrich_version_with_names(db, v) for v in template.versions]
    result.replication_count = 0
    return result


@router.get("/{template_id}", response_model=ExperimentTemplateDetailOut)
def get_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    result = ExperimentTemplateDetailOut.model_validate(template)
    result.versions = [_enrich_version_with_names(db, v) for v in template.versions]
    result.replication_count = _get_replication_count(db, template.id)
    return result


@router.put("/{template_id}", response_model=ExperimentTemplateDetailOut)
def update_template(template_id: int, data: ExperimentTemplateUpdate, db: Session = Depends(get_db)):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    if data.name is not None and data.name != template.name:
        existing = db.query(ExperimentTemplate).filter(ExperimentTemplate.name == data.name).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"模板名称 '{data.name}' 已存在")

    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)

    result = ExperimentTemplateDetailOut.model_validate(template)
    result.versions = [_enrich_version_with_names(db, v) for v in template.versions]
    result.replication_count = _get_replication_count(db, template.id)
    return result


@router.delete("/{template_id}", status_code=204)
def delete_template(template_id: int, db: Session = Depends(get_db)):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    repl_count = _get_replication_count(db, template_id)
    if repl_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"该模板已有 {repl_count} 条复刻记录，无法删除。可先设置为停用。",
        )

    db.delete(template)
    db.commit()


@router.post("/{template_id}/versions", response_model=TemplateVersionOut, status_code=201)
def create_template_version(template_id: int, data: TemplateVersionCreate, db: Session = Depends(get_db)):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    last_version = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id
    ).order_by(TemplateVersion.version.desc()).first()

    next_version = (last_version.version + 1) if last_version else 1

    version = TemplateVersion(
        template_id=template_id,
        version=next_version,
        version_name=data.version_name or f"v{next_version}",
        change_notes=data.change_notes,
        target_concentration=data.target_concentration,
        notes=data.notes,
    )
    db.add(version)
    db.flush()

    for comp_data in data.components:
        comp = TemplateComponent(
            version_id=version.id,
            material_type=comp_data.material_type.value,
            fiber_source_id=comp_data.fiber_source_id,
            sizing_agent_id=comp_data.sizing_agent_id,
            mineral_filler_id=comp_data.mineral_filler_id,
            ratio=comp_data.ratio,
            notes=comp_data.notes,
        )
        db.add(comp)

    db.commit()
    db.refresh(version)

    return _enrich_version_with_names(db, version)


@router.get("/{template_id}/versions", response_model=List[TemplateVersionOut])
def list_template_versions(template_id: int, db: Session = Depends(get_db)):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    versions = db.query(TemplateVersion).filter(
        TemplateVersion.template_id == template_id
    ).order_by(TemplateVersion.version.desc()).all()

    return [_enrich_version_with_names(db, v) for v in versions]


@router.post("/{template_id}/replicate", response_model=TemplateReplicationOut, status_code=201)
def replicate_template_to_batch(
    template_id: int,
    data: TemplateReplicateBatch,
    db: Session = Depends(get_db),
):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")
    if not template.is_active:
        raise HTTPException(status_code=400, detail="该模板已停用，无法复刻")

    if data.version_id:
        version = db.query(TemplateVersion).filter(
            TemplateVersion.id == data.version_id,
            TemplateVersion.template_id == template_id,
        ).first()
        if not version:
            raise HTTPException(status_code=404, detail="指定的模板版本不存在")
    else:
        version = template.latest_version
        if not version:
            raise HTTPException(status_code=400, detail="模板尚无版本，无法复刻")

    existing_batch = db.query(PulpBatch).filter(PulpBatch.batch_no == data.batch_no).first()
    if existing_batch:
        raise HTTPException(status_code=400, detail=f"批次编号 '{data.batch_no}' 已存在")

    batch = PulpBatch(
        batch_no=data.batch_no,
        notes=data.notes,
    )
    db.add(batch)
    db.flush()

    for comp in version.components:
        pulp_comp = PulpComponent(
            batch_id=batch.id,
            material_type=comp.material_type,
            fiber_source_id=comp.fiber_source_id,
            sizing_agent_id=comp.sizing_agent_id,
            mineral_filler_id=comp.mineral_filler_id,
            ratio=comp.ratio,
            notes=comp.notes,
        )
        db.add(pulp_comp)

    repl_type = "adjusted" if data.adjustment_notes else "direct"
    replication = TemplateReplication(
        template_id=template_id,
        version_id=version.id,
        batch_id=batch.id,
        replication_type=repl_type,
        adjustment_notes=data.adjustment_notes,
    )
    db.add(replication)

    db.commit()
    db.refresh(replication)
    db.refresh(batch)

    result = TemplateReplicationOut.model_validate(replication)
    result.batch_no = batch.batch_no
    result.version_number = version.version
    return result


@router.get("/{template_id}/replications", response_model=List[TemplateReplicationOut])
def list_template_replications(
    template_id: int,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    template = db.query(ExperimentTemplate).filter(ExperimentTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="实验模板不存在")

    replications = (
        db.query(TemplateReplication)
        .filter(TemplateReplication.template_id == template_id)
        .order_by(TemplateReplication.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )

    results = []
    for r in replications:
        out = TemplateReplicationOut.model_validate(r)
        out.batch_no = r.batch.batch_no if r.batch else None
        out.version_number = r.version.version if r.version else None
        results.append(out)
    return results
