from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session, joinedload
from typing import List, Optional, Dict, Any
from datetime import datetime
import os
import uuid
import mimetypes
import json

from app.database import get_db
from app.models import (
    ExperimentImage, ImageAnnotation,
    PulpBatch, PapermakingRecord, PaperObservation,
    FiberSource, SizingAgent, MineralFiller,
)
from app.schemas import (
    ExperimentImageCreate, ExperimentImageUpdate, ExperimentImageOut, ExperimentImageWithUrl,
    ImageAnnotationCreate, ImageAnnotationUpdate, ImageAnnotationOut,
    ImageCategory, ImageCompareRequest,
    BatchTimelineOut, BatchTimelineImage,
    ExperimentImageSummary, TypicalImageSummary,
    UploadResult,
)

router = APIRouter(prefix="/images", tags=["实验图片管理"])

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp", ".tiff", ".webp"}
MAX_FILE_SIZE = 10 * 1024 * 1024

CATEGORY_NAMES = {
    "raw_material": "原料",
    "wet_paper": "湿纸页",
    "dry_paper": "成纸",
    "microscopy": "显微结构",
}


def _get_image_url(image_id: int) -> str:
    return f"/images/{image_id}/file"


def _to_image_with_url(image: ExperimentImage) -> ExperimentImageWithUrl:
    return ExperimentImageWithUrl(
        id=image.id,
        file_path=image.file_path,
        file_name=image.file_name,
        file_size=image.file_size,
        mime_type=image.mime_type,
        category=image.category,
        title=image.title,
        description=image.description,
        is_hidden=image.is_hidden,
        is_typical=image.is_typical,
        sort_order=image.sort_order,
        fiber_source_id=image.fiber_source_id,
        sizing_agent_id=image.sizing_agent_id,
        mineral_filler_id=image.mineral_filler_id,
        batch_id=image.batch_id,
        record_id=image.record_id,
        observation_id=image.observation_id,
        captured_at=image.captured_at,
        captured_by=image.captured_by,
        microscope_settings=image.microscope_settings,
        extra_metadata=image.extra_metadata,
        created_at=image.created_at,
        updated_at=image.updated_at,
        annotations=image.annotations,
        url=_get_image_url(image.id),
    )


def _validate_image_entity(db: Session, data: ExperimentImageCreate):
    if data.fiber_source_id is not None:
        obj = db.query(FiberSource).filter(FiberSource.id == data.fiber_source_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"纤维原料不存在: {data.fiber_source_id}")
    if data.sizing_agent_id is not None:
        obj = db.query(SizingAgent).filter(SizingAgent.id == data.sizing_agent_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"胶料不存在: {data.sizing_agent_id}")
    if data.mineral_filler_id is not None:
        obj = db.query(MineralFiller).filter(MineralFiller.id == data.mineral_filler_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"矿物填料不存在: {data.mineral_filler_id}")
    if data.batch_id is not None:
        obj = db.query(PulpBatch).filter(PulpBatch.id == data.batch_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"配浆批次不存在: {data.batch_id}")
    if data.record_id is not None:
        obj = db.query(PapermakingRecord).filter(PapermakingRecord.id == data.record_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"抄纸记录不存在: {data.record_id}")
    if data.observation_id is not None:
        obj = db.query(PaperObservation).filter(PaperObservation.id == data.observation_id).first()
        if not obj:
            raise HTTPException(status_code=404, detail=f"成纸观察不存在: {data.observation_id}")


@router.post("/upload", response_model=UploadResult, status_code=201)
async def upload_image(
    file: UploadFile = File(...),
    category: ImageCategory = Form(...),
    title: Optional[str] = Form(None),
    description: Optional[str] = Form(None),
    is_hidden: bool = Form(False),
    is_typical: bool = Form(False),
    sort_order: int = Form(0),
    fiber_source_id: Optional[int] = Form(None),
    sizing_agent_id: Optional[int] = Form(None),
    mineral_filler_id: Optional[int] = Form(None),
    batch_id: Optional[int] = Form(None),
    record_id: Optional[int] = Form(None),
    observation_id: Optional[int] = Form(None),
    captured_at: Optional[datetime] = Form(None),
    captured_by: Optional[str] = Form(None),
    microscope_settings: Optional[str] = Form(None),
    extra_metadata: Optional[str] = Form(None),
    db: Session = Depends(get_db),
):
    associations = [fiber_source_id, sizing_agent_id, mineral_filler_id, batch_id, record_id, observation_id]
    if all(a is None for a in associations):
        raise HTTPException(status_code=400, detail="图片必须关联至少一个实验对象")

    ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"不支持的文件格式，允许的格式: {', '.join(ALLOWED_EXTENSIONS)}")

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail=f"文件大小超过限制，最大允许: {MAX_FILE_SIZE // 1024 // 1024}MB")

    unique_filename = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(file_path, "wb") as f:
        f.write(file_bytes)

    mime_type = mimetypes.guess_type(file.filename)[0] if file.filename else None

    microscope_settings_parsed = None
    if microscope_settings:
        try:
            microscope_settings_parsed = json.loads(microscope_settings)
        except:
            raise HTTPException(status_code=400, detail="microscope_settings 必须是有效的 JSON 格式")

    extra_metadata_parsed = None
    if extra_metadata:
        try:
            extra_metadata_parsed = json.loads(extra_metadata)
        except:
            raise HTTPException(status_code=400, detail="extra_metadata 必须是有效的 JSON 格式")

    image_data = ExperimentImageCreate(
        category=category,
        title=title,
        description=description,
        is_hidden=is_hidden,
        is_typical=is_typical,
        sort_order=sort_order,
        fiber_source_id=fiber_source_id,
        sizing_agent_id=sizing_agent_id,
        mineral_filler_id=mineral_filler_id,
        batch_id=batch_id,
        record_id=record_id,
        observation_id=observation_id,
        captured_at=captured_at,
        captured_by=captured_by,
        microscope_settings=microscope_settings_parsed,
        extra_metadata=extra_metadata_parsed,
    )

    _validate_image_entity(db, image_data)

    image = ExperimentImage(
        file_path=file_path,
        file_name=file.filename or unique_filename,
        file_size=len(file_bytes),
        mime_type=mime_type,
        category=category.value,
        title=title,
        description=description,
        is_hidden=is_hidden,
        is_typical=is_typical,
        sort_order=sort_order,
        fiber_source_id=fiber_source_id,
        sizing_agent_id=sizing_agent_id,
        mineral_filler_id=mineral_filler_id,
        batch_id=batch_id,
        record_id=record_id,
        observation_id=observation_id,
        captured_at=captured_at,
        captured_by=captured_by,
        microscope_settings=microscope_settings_parsed,
        extra_metadata=extra_metadata_parsed,
    )

    db.add(image)
    db.commit()
    db.refresh(image)

    return UploadResult(
        success=True,
        image_id=image.id,
        message="上传成功",
        file_name=image.file_name,
    )


@router.get("/{image_id}/file")
def get_image_file(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    if not os.path.exists(image.file_path):
        raise HTTPException(status_code=404, detail="图片文件已丢失")
    return FileResponse(
        image.file_path,
        media_type=image.mime_type or "application/octet-stream",
        filename=image.file_name,
    )


@router.get("/summary", response_model=ExperimentImageSummary)
def get_image_summary(
    fiber_source_id: Optional[int] = None,
    sizing_agent_id: Optional[int] = None,
    mineral_filler_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    record_id: Optional[int] = None,
    observation_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ExperimentImage)

    if fiber_source_id:
        query = query.filter(ExperimentImage.fiber_source_id == fiber_source_id)
    if sizing_agent_id:
        query = query.filter(ExperimentImage.sizing_agent_id == sizing_agent_id)
    if mineral_filler_id:
        query = query.filter(ExperimentImage.mineral_filler_id == mineral_filler_id)
    if batch_id:
        query = query.filter(ExperimentImage.batch_id == batch_id)
    if record_id:
        query = query.filter(ExperimentImage.record_id == record_id)
    if observation_id:
        query = query.filter(ExperimentImage.observation_id == observation_id)

    all_images = query.all()
    visible_images = [img for img in all_images if not img.is_hidden]
    typical_images = [img for img in visible_images if img.is_typical]

    by_category: Dict[str, int] = {}
    for img in visible_images:
        by_category[img.category] = by_category.get(img.category, 0) + 1

    typical_summary = []
    for category in ["raw_material", "wet_paper", "dry_paper", "microscopy"]:
        cat_typical = [img for img in typical_images if img.category == category]
        if cat_typical:
            obs_notes = []
            for img in cat_typical:
                if img.observation_id:
                    obs = db.query(PaperObservation).filter(PaperObservation.id == img.observation_id).first()
                    if obs and obs.notes:
                        obs_notes.append(obs.notes)
                if img.description:
                    obs_notes.append(img.description)

            typical_summary.append(TypicalImageSummary(
                category=category,
                category_name=CATEGORY_NAMES.get(category, category),
                images=[_to_image_with_url(img) for img in cat_typical],
                observation_notes=obs_notes,
            ))

    return ExperimentImageSummary(
        total_images=len(all_images),
        visible_images=len(visible_images),
        typical_images=len(typical_images),
        by_category=by_category,
        typical_summary=typical_summary,
    )


@router.get("/", response_model=List[ExperimentImageWithUrl])
def list_images(
    skip: int = 0,
    limit: int = 100,
    category: Optional[ImageCategory] = None,
    include_hidden: bool = False,
    fiber_source_id: Optional[int] = None,
    sizing_agent_id: Optional[int] = None,
    mineral_filler_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    record_id: Optional[int] = None,
    observation_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations))

    if not include_hidden:
        query = query.filter(ExperimentImage.is_hidden == False)
    if category:
        query = query.filter(ExperimentImage.category == category.value)
    if fiber_source_id:
        query = query.filter(ExperimentImage.fiber_source_id == fiber_source_id)
    if sizing_agent_id:
        query = query.filter(ExperimentImage.sizing_agent_id == sizing_agent_id)
    if mineral_filler_id:
        query = query.filter(ExperimentImage.mineral_filler_id == mineral_filler_id)
    if batch_id:
        query = query.filter(ExperimentImage.batch_id == batch_id)
    if record_id:
        query = query.filter(ExperimentImage.record_id == record_id)
    if observation_id:
        query = query.filter(ExperimentImage.observation_id == observation_id)

    images = query.order_by(ExperimentImage.sort_order, ExperimentImage.created_at.desc()).offset(skip).limit(limit).all()
    return [_to_image_with_url(img) for img in images]


@router.get("/{image_id}", response_model=ExperimentImageWithUrl)
def get_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    return _to_image_with_url(image)


@router.put("/{image_id}", response_model=ExperimentImageWithUrl)
def update_image(image_id: int, data: ExperimentImageUpdate, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")

    for key, value in data.model_dump(exclude_unset=True).items():
        if isinstance(value, ImageCategory):
            value = value.value
        setattr(image, key, value)

    db.commit()
    db.refresh(image)
    return _to_image_with_url(image)


@router.delete("/{image_id}", status_code=204)
def delete_image(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")

    if os.path.exists(image.file_path):
        try:
            os.remove(image.file_path)
        except:
            pass

    db.delete(image)
    db.commit()


@router.post("/{image_id}/toggle-hidden", response_model=ExperimentImageWithUrl)
def toggle_image_hidden(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    image.is_hidden = not image.is_hidden
    db.commit()
    db.refresh(image)
    return _to_image_with_url(image)


@router.post("/{image_id}/toggle-typical", response_model=ExperimentImageWithUrl)
def toggle_image_typical(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    image.is_typical = not image.is_typical
    db.commit()
    db.refresh(image)
    return _to_image_with_url(image)


@router.post("/{image_id}/annotations", response_model=ImageAnnotationOut, status_code=201)
def add_image_annotation(image_id: int, data: ImageAnnotationCreate, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")

    annotation = ImageAnnotation(
        image_id=image_id,
        label=data.label,
        description=data.description,
        region_type=data.region_type,
        region_data=data.region_data,
        color=data.color,
        sort_order=data.sort_order,
    )
    db.add(annotation)
    db.commit()
    db.refresh(annotation)
    return annotation


@router.get("/{image_id}/annotations", response_model=List[ImageAnnotationOut])
def list_image_annotations(image_id: int, db: Session = Depends(get_db)):
    image = db.query(ExperimentImage).filter(ExperimentImage.id == image_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="图片不存在")
    return db.query(ImageAnnotation).filter(ImageAnnotation.image_id == image_id).order_by(ImageAnnotation.sort_order, ImageAnnotation.created_at).all()


@router.put("/annotations/{annotation_id}", response_model=ImageAnnotationOut)
def update_image_annotation(annotation_id: int, data: ImageAnnotationUpdate, db: Session = Depends(get_db)):
    annotation = db.query(ImageAnnotation).filter(ImageAnnotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")

    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(annotation, key, value)

    db.commit()
    db.refresh(annotation)
    return annotation


@router.delete("/annotations/{annotation_id}", status_code=204)
def delete_image_annotation(annotation_id: int, db: Session = Depends(get_db)):
    annotation = db.query(ImageAnnotation).filter(ImageAnnotation.id == annotation_id).first()
    if not annotation:
        raise HTTPException(status_code=404, detail="标注不存在")
    db.delete(annotation)
    db.commit()


@router.post("/compare", response_model=List[ExperimentImageWithUrl])
def compare_images(data: ImageCompareRequest, db: Session = Depends(get_db)):
    images = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(
        ExperimentImage.id.in_(data.image_ids),
        ExperimentImage.is_hidden == False,
    ).all()

    if len(images) != len(data.image_ids):
        found_ids = {img.id for img in images}
        missing = [i for i in data.image_ids if i not in found_ids]
        raise HTTPException(status_code=404, detail=f"以下图片不存在或已隐藏: {missing}")

    return [_to_image_with_url(img) for img in images]


@router.get("/batch/{batch_id}/timeline", response_model=BatchTimelineOut)
def get_batch_timeline(batch_id: int, include_hidden: bool = False, db: Session = Depends(get_db)):
    batch = db.query(PulpBatch).filter(PulpBatch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="配浆批次不存在")

    query = db.query(ExperimentImage).options(joinedload(ExperimentImage.annotations)).filter(
        ExperimentImage.batch_id == batch_id,
    )

    if not include_hidden:
        query = query.filter(ExperimentImage.is_hidden == False)

    all_images = query.order_by(ExperimentImage.sort_order, ExperimentImage.created_at).all()

    records = db.query(PapermakingRecord).options(
        joinedload(PapermakingRecord.observations)
    ).filter(PapermakingRecord.batch_id == batch_id).order_by(PapermakingRecord.paper_date).all()

    timeline_phases = []

    raw_material_images = [img for img in all_images if img.category == "raw_material"]
    if raw_material_images:
        timeline_phases.append(BatchTimelineImage(
            phase="raw_material",
            phase_title="原料准备",
            timestamp=batch.created_at,
            images=[_to_image_with_url(img) for img in raw_material_images],
        ))

    wet_paper_images = [img for img in all_images if img.category == "wet_paper"]
    if wet_paper_images:
        for record in records:
            record_images = [img for img in wet_paper_images if img.record_id == record.id]
            if record_images:
                timeline_phases.append(BatchTimelineImage(
                    phase=f"wet_paper_{record.id}",
                    phase_title=f"湿纸页 - {record.paper_date.isoformat()}",
                    timestamp=datetime.combine(record.paper_date, datetime.min.time()),
                    images=[_to_image_with_url(img) for img in record_images],
                ))
            elif not any(img.record_id for img in wet_paper_images):
                timeline_phases.append(BatchTimelineImage(
                    phase="wet_paper",
                    phase_title="湿纸页",
                    timestamp=batch.created_at,
                    images=[_to_image_with_url(img) for img in wet_paper_images],
                ))
                break

    dry_paper_images = [img for img in all_images if img.category == "dry_paper"]
    if dry_paper_images:
        for record in records:
            record_images = [img for img in dry_paper_images if img.record_id == record.id]
            if record_images:
                timeline_phases.append(BatchTimelineImage(
                    phase=f"dry_paper_{record.id}",
                    phase_title=f"成纸 - {record.paper_date.isoformat()}",
                    timestamp=datetime.combine(record.paper_date, datetime.min.time()),
                    images=[_to_image_with_url(img) for img in record_images],
                ))
            elif not any(img.record_id for img in dry_paper_images):
                timeline_phases.append(BatchTimelineImage(
                    phase="dry_paper",
                    phase_title="成纸",
                    timestamp=batch.created_at,
                    images=[_to_image_with_url(img) for img in dry_paper_images],
                ))
                break

    microscopy_images = [img for img in all_images if img.category == "microscopy"]
    if microscopy_images:
        for obs_id in set(img.observation_id for img in microscopy_images if img.observation_id):
            obs_images = [img for img in microscopy_images if img.observation_id == obs_id]
            obs = db.query(PaperObservation).filter(PaperObservation.id == obs_id).first()
            if obs:
                record = db.query(PapermakingRecord).filter(PapermakingRecord.id == obs.record_id).first()
                timestamp = record.paper_date if record else batch.created_at
                timeline_phases.append(BatchTimelineImage(
                    phase=f"microscopy_{obs_id}",
                    phase_title=f"显微结构 - 观察#{obs_id}",
                    timestamp=datetime.combine(timestamp, datetime.min.time()) if hasattr(timestamp, 'isoformat') else timestamp,
                    images=[_to_image_with_url(img) for img in obs_images],
                ))
        if not any(img.observation_id for img in microscopy_images):
            timeline_phases.append(BatchTimelineImage(
                phase="microscopy",
                phase_title="显微结构",
                timestamp=batch.created_at,
                images=[_to_image_with_url(img) for img in microscopy_images],
            ))

    timeline_phases.sort(key=lambda x: x.timestamp)

    return BatchTimelineOut(
        batch_id=batch.id,
        batch_no=batch.batch_no,
        timeline=timeline_phases,
    )
