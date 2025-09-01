"""
Source data model.
"""
from typing import Dict, Any, Optional
from dataclasses import dataclass
from .base import BaseModel


@dataclass
class Source(BaseModel):
    """Represents a source in the TMI system."""
    
    threat_model_id: Optional[str] = None
    name: Optional[str] = None
    description: Optional[str] = None
    source_type: Optional[str] = None
    url: Optional[str] = None
    version: Optional[str] = None
    author: Optional[str] = None