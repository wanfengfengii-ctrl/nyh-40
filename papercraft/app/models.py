from sqlalchemy import (
    Column, Integer, String, Float, Boolean, Date, DateTime, Text, ForeignKey, UniqueConstraint,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base


class FiberSource(Base):
    __tablename__ = "fiber_sources"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    fiber_type = Column(String(50), nullable=False)
    origin = Column(String(200), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pulp_components = relationship("PulpComponent", back_populates="fiber_source")


class SizingAgent(Base):
    __tablename__ = "sizing_agents"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    agent_type = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pulp_components = relationship("PulpComponent", back_populates="sizing_agent")


class MineralFiller(Base):
    __tablename__ = "mineral_fillers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    filler_type = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    pulp_components = relationship("PulpComponent", back_populates="mineral_filler")


class PulpBatch(Base):
    __tablename__ = "pulp_batches"

    id = Column(Integer, primary_key=True, index=True)
    batch_no = Column(String(50), unique=True, nullable=False, index=True)
    is_sealed = Column(Boolean, default=False)
    hidden = Column(Boolean, default=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    components = relationship("PulpComponent", back_populates="batch", cascade="all, delete-orphan")
    concentrations = relationship("VatConcentration", back_populates="batch", cascade="all, delete-orphan")
    papermaking_records = relationship("PapermakingRecord", back_populates="batch", cascade="all, delete-orphan")


class PulpComponent(Base):
    __tablename__ = "pulp_components"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("pulp_batches.id"), nullable=False)
    material_type = Column(String(20), nullable=False)
    fiber_source_id = Column(Integer, ForeignKey("fiber_sources.id"), nullable=True)
    sizing_agent_id = Column(Integer, ForeignKey("sizing_agents.id"), nullable=True)
    mineral_filler_id = Column(Integer, ForeignKey("mineral_fillers.id"), nullable=True)
    ratio = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    batch = relationship("PulpBatch", back_populates="components")
    fiber_source = relationship("FiberSource", back_populates="pulp_components")
    sizing_agent = relationship("SizingAgent", back_populates="pulp_components")
    mineral_filler = relationship("MineralFiller", back_populates="pulp_components")


class VatConcentration(Base):
    __tablename__ = "vat_concentrations"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("pulp_batches.id"), nullable=False)
    concentration = Column(Float, nullable=False)
    measured_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)

    batch = relationship("PulpBatch", back_populates="concentrations")


class PapermakingRecord(Base):
    __tablename__ = "papermaking_records"

    id = Column(Integer, primary_key=True, index=True)
    batch_id = Column(Integer, ForeignKey("pulp_batches.id"), nullable=False)
    paper_date = Column(Date, nullable=False)
    operator = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    batch = relationship("PulpBatch", back_populates="papermaking_records")
    observations = relationship("PaperObservation", back_populates="record", cascade="all, delete-orphan")


class PaperObservation(Base):
    __tablename__ = "paper_observations"

    id = Column(Integer, primary_key=True, index=True)
    record_id = Column(Integer, ForeignKey("papermaking_records.id"), nullable=False)
    thickness = Column(Float, nullable=True)
    tensile_strength = Column(Float, nullable=True)
    absorbency = Column(Float, nullable=True)
    color = Column(String(50), nullable=True)
    texture = Column(String(50), nullable=True)
    overall_rating = Column(Integer, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    record = relationship("PapermakingRecord", back_populates="observations")


class ExperimentTemplate(Base):
    __tablename__ = "experiment_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False, index=True)
    category = Column(String(50), nullable=True, index=True)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    versions = relationship("TemplateVersion", back_populates="template", cascade="all, delete-orphan", order_by="TemplateVersion.version.desc()")
    replications = relationship("TemplateReplication", back_populates="template", cascade="all, delete-orphan")

    @property
    def latest_version(self):
        return self.versions[0] if self.versions else None


class TemplateVersion(Base):
    __tablename__ = "template_versions"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("experiment_templates.id"), nullable=False)
    version = Column(Integer, nullable=False, default=1)
    version_name = Column(String(100), nullable=True)
    change_notes = Column(Text, nullable=True)
    target_concentration = Column(Float, nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("ExperimentTemplate", back_populates="versions")
    components = relationship("TemplateComponent", back_populates="version", cascade="all, delete-orphan")

    __table_args__ = (UniqueConstraint("template_id", "version", name="uq_template_version"),)


class TemplateComponent(Base):
    __tablename__ = "template_components"

    id = Column(Integer, primary_key=True, index=True)
    version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    material_type = Column(String(20), nullable=False)
    fiber_source_id = Column(Integer, ForeignKey("fiber_sources.id"), nullable=True)
    sizing_agent_id = Column(Integer, ForeignKey("sizing_agents.id"), nullable=True)
    mineral_filler_id = Column(Integer, ForeignKey("mineral_fillers.id"), nullable=True)
    ratio = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)

    version = relationship("TemplateVersion", back_populates="components")
    fiber_source = relationship("FiberSource")
    sizing_agent = relationship("SizingAgent")
    mineral_filler = relationship("MineralFiller")


class TemplateReplication(Base):
    __tablename__ = "template_replications"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("experiment_templates.id"), nullable=False)
    version_id = Column(Integer, ForeignKey("template_versions.id"), nullable=False)
    batch_id = Column(Integer, ForeignKey("pulp_batches.id"), nullable=False, unique=True)
    replication_type = Column(String(20), nullable=False, default="direct")
    adjustment_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    template = relationship("ExperimentTemplate", back_populates="replications")
    version = relationship("TemplateVersion")
    batch = relationship("PulpBatch")
