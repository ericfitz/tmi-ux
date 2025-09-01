"""
Threat Model data model.
"""
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from .base import BaseModel


@dataclass
class ThreatModel(BaseModel):
    """Represents a threat model in the TMI system."""
    
    name: Optional[str] = None
    description: Optional[str] = None
    owner_id: Optional[str] = None
    version: Optional[str] = None
    status: Optional[str] = None
    tags: List[str] = None
    
    def __post_init__(self):
        """Initialize default values after dataclass creation."""
        if self.tags is None:
            self.tags = []