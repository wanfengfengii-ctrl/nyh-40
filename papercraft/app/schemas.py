from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, List, Dict, Any
from datetime import date, datetime
from enum import Enum


class MaterialType(str, Enum):
    fiber = "fiber"
    sizing = "sizing"
    filler = "filler"


class FiberSourceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    fiber_type: str = Field(..., min_length=1, max_length=50)
    origin: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class FiberSourceUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    fiber_type: Optional[str] = Field(None, min_length=1, max_length=50)
    origin: Optional[str] = Field(None, max_length=200)
    notes: Optional[str] = None


class FiberSourceOut(BaseModel):
    id: int
    name: str
    fiber_type: str
    origin: Optional[str]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SizingAgentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    agent_type: str = Field(..., min_length=1, max_length=50)
    notes: Optional[str] = None


class SizingAgentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    agent_type: Optional[str] = Field(None, min_length=1, max_length=50)
    notes: Optional[str] = None


class SizingAgentOut(BaseModel):
    id: int
    name: str
    agent_type: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class MineralFillerCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    filler_type: str = Field(..., min_length=1, max_length=50)
    notes: Optional[str] = None


class MineralFillerUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    filler_type: Optional[str] = Field(None, min_length=1, max_length=50)
    notes: Optional[str] = None


class MineralFillerOut(BaseModel):
    id: int
    name: str
    filler_type: str
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class PulpComponentCreate(BaseModel):
    material_type: MaterialType
    fiber_source_id: Optional[int] = None
    sizing_agent_id: Optional[int] = None
    mineral_filler_id: Optional[int] = None
    ratio: float = Field(..., gt=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_material_refs(self):
        if self.material_type == MaterialType.fiber and self.fiber_source_id is None:
            raise ValueError("纤维类型成分必须指定 fiber_source_id")
        if self.material_type == MaterialType.sizing and self.sizing_agent_id is None:
            raise ValueError("胶料类型成分必须指定 sizing_agent_id")
        if self.material_type == MaterialType.filler and self.mineral_filler_id is None:
            raise ValueError("填料类型成分必须指定 mineral_filler_id")
        return self


class PulpComponentOut(BaseModel):
    id: int
    batch_id: int
    material_type: str
    fiber_source_id: Optional[int]
    sizing_agent_id: Optional[int]
    mineral_filler_id: Optional[int]
    ratio: float
    notes: Optional[str]

    model_config = {"from_attributes": True}


class PulpBatchCreate(BaseModel):
    batch_no: str = Field(..., min_length=1, max_length=50)
    notes: Optional[str] = None
    components: List[PulpComponentCreate] = []


class PulpBatchUpdate(BaseModel):
    batch_no: Optional[str] = Field(None, min_length=1, max_length=50)
    is_sealed: Optional[bool] = None
    hidden: Optional[bool] = None
    notes: Optional[str] = None


class PulpBatchOut(BaseModel):
    id: int
    batch_no: str
    is_sealed: bool
    hidden: bool
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime
    components: List[PulpComponentOut] = []

    model_config = {"from_attributes": True}


class VatConcentrationCreate(BaseModel):
    concentration: float = Field(..., ge=0)
    notes: Optional[str] = None

    @field_validator("concentration")
    @classmethod
    def concentration_not_negative(cls, v):
        if v < 0:
            raise ValueError("槽液浓度不能为负数")
        return v


class VatConcentrationOut(BaseModel):
    id: int
    batch_id: int
    concentration: float
    measured_at: datetime
    notes: Optional[str]

    model_config = {"from_attributes": True}


class PapermakingRecordCreate(BaseModel):
    paper_date: date
    operator: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    @field_validator("paper_date")
    @classmethod
    def paper_date_not_future(cls, v):
        if v > date.today():
            raise ValueError("抄纸日期不能晚于当前日期")
        return v


class PapermakingRecordUpdate(BaseModel):
    paper_date: Optional[date] = None
    operator: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None

    @field_validator("paper_date")
    @classmethod
    def paper_date_not_future(cls, v):
        if v is not None and v > date.today():
            raise ValueError("抄纸日期不能晚于当前日期")
        return v


class PapermakingRecordOut(BaseModel):
    id: int
    batch_id: int
    paper_date: date
    operator: Optional[str]
    notes: Optional[str]
    created_at: datetime
    observations: List["PaperObservationOut"] = []

    model_config = {"from_attributes": True}


class PaperObservationCreate(BaseModel):
    thickness: Optional[float] = Field(None, ge=0)
    tensile_strength: Optional[float] = Field(None, ge=0)
    absorbency: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, max_length=50)
    texture: Optional[str] = Field(None, max_length=50)
    overall_rating: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None


class PaperObservationUpdate(BaseModel):
    thickness: Optional[float] = Field(None, ge=0)
    tensile_strength: Optional[float] = Field(None, ge=0)
    absorbency: Optional[float] = Field(None, ge=0)
    color: Optional[str] = Field(None, max_length=50)
    texture: Optional[str] = Field(None, max_length=50)
    overall_rating: Optional[int] = Field(None, ge=1, le=10)
    notes: Optional[str] = None


class PaperObservationOut(BaseModel):
    id: int
    record_id: int
    thickness: Optional[float]
    tensile_strength: Optional[float]
    absorbency: Optional[float]
    color: Optional[str]
    texture: Optional[str]
    overall_rating: Optional[int]
    notes: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


PapermakingRecordOut.model_rebuild()


class BatchDeleteConfirm(BaseModel):
    confirmed: bool = Field(..., description="确认删除：已有成纸观察的批次需二次确认")


class BatchComparison(BaseModel):
    batch_ids: List[int] = Field(..., min_length=2)


class BatchTraceOut(BaseModel):
    batch: PulpBatchOut
    concentrations: List[VatConcentrationOut]
    papermaking_records: List[PapermakingRecordOut]


class MaterialProportionItem(BaseModel):
    material_type: str
    material_id: int
    material_name: str
    total_ratio: float
    ratio_percentage: float


class MaterialProportionStat(BaseModel):
    batch_count: int
    total_ratio_sum: float
    items: List[MaterialProportionItem]


class ExperimentSummary(BaseModel):
    total_batches: int
    visible_batches: int
    sealed_batches: int
    total_papermaking_records: int
    total_observations: int
    avg_overall_rating: Optional[float]
    fiber_distribution: dict
    sizing_distribution: dict
    filler_distribution: dict
    concentration_stats: dict
    date_range: Optional[dict]
    image_summary: Optional["ExperimentImageSummary"] = None


class RawPulpComponent(BaseModel):
    material_type: Optional[str] = None
    fiber_source_id: Optional[int] = None
    sizing_agent_id: Optional[int] = None
    mineral_filler_id: Optional[int] = None
    ratio: Optional[float] = None
    notes: Optional[str] = None


class ImportRecord(BaseModel):
    batch_no: Optional[str] = None
    notes: Optional[str] = None
    components: List[RawPulpComponent] = []


class ImportResult(BaseModel):
    imported: int
    skipped: int
    errors: List[str]


class TemplateComponentCreate(BaseModel):
    material_type: MaterialType
    fiber_source_id: Optional[int] = None
    sizing_agent_id: Optional[int] = None
    mineral_filler_id: Optional[int] = None
    ratio: float = Field(..., gt=0)
    notes: Optional[str] = None

    @model_validator(mode="after")
    def validate_material_refs(self):
        if self.material_type == MaterialType.fiber and self.fiber_source_id is None:
            raise ValueError("纤维类型成分必须指定 fiber_source_id")
        if self.material_type == MaterialType.sizing and self.sizing_agent_id is None:
            raise ValueError("胶料类型成分必须指定 sizing_agent_id")
        if self.material_type == MaterialType.filler and self.mineral_filler_id is None:
            raise ValueError("填料类型成分必须指定 mineral_filler_id")
        return self


class TemplateComponentOut(BaseModel):
    id: int
    version_id: int
    material_type: str
    fiber_source_id: Optional[int]
    sizing_agent_id: Optional[int]
    mineral_filler_id: Optional[int]
    ratio: float
    notes: Optional[str]
    material_name: Optional[str] = None

    model_config = {"from_attributes": True}


class TemplateVersionCreate(BaseModel):
    version_name: Optional[str] = Field(None, max_length=100)
    change_notes: Optional[str] = None
    target_concentration: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = None
    components: List[TemplateComponentCreate] = []


class TemplateVersionOut(BaseModel):
    id: int
    template_id: int
    version: int
    version_name: Optional[str]
    change_notes: Optional[str]
    target_concentration: Optional[float]
    notes: Optional[str]
    created_at: datetime
    components: List[TemplateComponentOut] = []

    model_config = {"from_attributes": True}


class ExperimentTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    initial_version: TemplateVersionCreate


class ExperimentTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ExperimentTemplateOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    latest_version: Optional[TemplateVersionOut] = None
    replication_count: int = 0

    model_config = {"from_attributes": True}


class ExperimentTemplateDetailOut(BaseModel):
    id: int
    name: str
    category: Optional[str]
    description: Optional[str]
    is_active: bool
    created_at: datetime
    updated_at: datetime
    versions: List[TemplateVersionOut] = []
    replication_count: int = 0

    model_config = {"from_attributes": True}


class TemplateReplicateBatch(BaseModel):
    batch_no: str = Field(..., min_length=1, max_length=50)
    version_id: Optional[int] = None
    notes: Optional[str] = None
    adjustment_notes: Optional[str] = None


class TemplateReplicationOut(BaseModel):
    id: int
    template_id: int
    version_id: int
    batch_id: int
    replication_type: str
    adjustment_notes: Optional[str]
    created_at: datetime
    batch_no: Optional[str] = None
    version_number: Optional[int] = None

    model_config = {"from_attributes": True}


class RecommendedScheme(BaseModel):
    batch_id: int
    batch_no: str
    similarity_score: float
    overall_rating: Optional[float]
    avg_concentration: Optional[float]
    components: List[PulpComponentOut] = []
    recommendation_reasons: List[str] = []
    adjustment_suggestions: List[str] = []


class SchemeRecommendationRequest(BaseModel):
    target_rating: Optional[int] = Field(None, ge=1, le=10)
    target_concentration: Optional[float] = Field(None, ge=0)
    fiber_preferences: Optional[List[int]] = None
    top_k: int = Field(5, ge=1, le=20)


class ImageCategory(str, Enum):
    raw_material = "raw_material"
    wet_paper = "wet_paper"
    dry_paper = "dry_paper"
    microscopy = "microscopy"


class ImageAnnotationCreate(BaseModel):
    label: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    region_type: Optional[str] = Field(None, max_length=50)
    region_data: Optional[Dict[str, Any]] = None
    color: Optional[str] = Field(None, max_length=20)
    sort_order: Optional[int] = 0


class ImageAnnotationUpdate(BaseModel):
    label: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    region_type: Optional[str] = Field(None, max_length=50)
    region_data: Optional[Dict[str, Any]] = None
    color: Optional[str] = Field(None, max_length=20)
    sort_order: Optional[int] = None


class ImageAnnotationOut(BaseModel):
    id: int
    image_id: int
    label: str
    description: Optional[str]
    region_type: Optional[str]
    region_data: Optional[Dict[str, Any]]
    color: Optional[str]
    sort_order: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ExperimentImageCreate(BaseModel):
    category: ImageCategory
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_hidden: Optional[bool] = False
    is_typical: Optional[bool] = False
    sort_order: Optional[int] = 0
    fiber_source_id: Optional[int] = None
    sizing_agent_id: Optional[int] = None
    mineral_filler_id: Optional[int] = None
    batch_id: Optional[int] = None
    record_id: Optional[int] = None
    observation_id: Optional[int] = None
    captured_at: Optional[datetime] = None
    captured_by: Optional[str] = Field(None, max_length=100)
    microscope_settings: Optional[Dict[str, Any]] = None
    extra_metadata: Optional[Dict[str, Any]] = None

    @model_validator(mode="after")
    def validate_at_least_one_association(self):
        associations = [
            self.fiber_source_id, self.sizing_agent_id, self.mineral_filler_id,
            self.batch_id, self.record_id, self.observation_id
        ]
        if all(a is None for a in associations):
            raise ValueError("图片必须关联至少一个实验对象（材料、批次、抄纸记录或成纸观察）")
        return self


class ExperimentImageUpdate(BaseModel):
    category: Optional[ImageCategory] = None
    title: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    is_hidden: Optional[bool] = None
    is_typical: Optional[bool] = None
    sort_order: Optional[int] = None
    fiber_source_id: Optional[int] = None
    sizing_agent_id: Optional[int] = None
    mineral_filler_id: Optional[int] = None
    batch_id: Optional[int] = None
    record_id: Optional[int] = None
    observation_id: Optional[int] = None
    captured_at: Optional[datetime] = None
    captured_by: Optional[str] = Field(None, max_length=100)
    microscope_settings: Optional[Dict[str, Any]] = None
    extra_metadata: Optional[Dict[str, Any]] = None


class ExperimentImageOut(BaseModel):
    id: int
    file_path: str
    file_name: str
    file_size: Optional[int]
    mime_type: Optional[str]
    category: str
    title: Optional[str]
    description: Optional[str]
    is_hidden: bool
    is_typical: bool
    sort_order: int
    fiber_source_id: Optional[int]
    sizing_agent_id: Optional[int]
    mineral_filler_id: Optional[int]
    batch_id: Optional[int]
    record_id: Optional[int]
    observation_id: Optional[int]
    captured_at: Optional[datetime]
    captured_by: Optional[str]
    microscope_settings: Optional[Dict[str, Any]]
    extra_metadata: Optional[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime
    annotations: List[ImageAnnotationOut] = []

    model_config = {"from_attributes": True}


class ExperimentImageWithUrl(ExperimentImageOut):
    url: str


class BatchTimelineImage(BaseModel):
    phase: str
    phase_title: str
    timestamp: datetime
    images: List[ExperimentImageWithUrl] = []


class BatchTimelineOut(BaseModel):
    batch_id: int
    batch_no: str
    timeline: List[BatchTimelineImage] = []


class ImageCompareRequest(BaseModel):
    image_ids: List[int] = Field(..., min_length=2, max_length=4)


class TypicalImageSummary(BaseModel):
    category: str
    category_name: str
    images: List[ExperimentImageWithUrl] = []
    observation_notes: List[str] = []


class ExperimentImageSummary(BaseModel):
    total_images: int
    visible_images: int
    typical_images: int
    by_category: Dict[str, int]
    typical_summary: List[TypicalImageSummary] = []


class UploadResult(BaseModel):
    success: bool
    image_id: Optional[int] = None
    message: Optional[str] = None
    file_name: Optional[str] = None


ExperimentSummary.model_rebuild()
