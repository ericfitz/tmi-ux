"""
Threat data model.
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from .base import BaseModel


@dataclass
class Threat(BaseModel):
    """Represents a threat in the TMI system."""
    
    threat_model_id: Optional[str] = None
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    severity: Optional[str] = None
    likelihood: Optional[str] = None
    impact: Optional[str] = None
    risk_score: Optional[float] = None
    status: Optional[str] = None
    assigned_to: Optional[str] = None
    tags: List[str] = None
    mitigation: Optional[str] = None
    references: List[str] = None
    
    def __post_init__(self):
        """Initialize default values after dataclass creation."""
        if self.tags is None:
            self.tags = []
        if self.references is None:
            self.references = []