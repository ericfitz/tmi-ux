"""
Diagram data model.
"""
from typing import Dict, Any, Optional
from dataclasses import dataclass
from .base import BaseModel


@dataclass
class Diagram(BaseModel):
    """Represents a diagram in the TMI system."""
    
    threat_model_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    diagram_type: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    version: Optional[str] = None
    
    def __post_init__(self):
        """Initialize default values after dataclass creation."""
        if self.content is None:
            self.content = {}