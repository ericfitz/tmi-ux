"""
Document data model.
"""
from typing import Dict, Any, Optional
from dataclasses import dataclass
from .base import BaseModel


@dataclass
class Document(BaseModel):
    """Represents a document in the TMI system."""
    
    threat_model_id: Optional[str] = None
    title: Optional[str] = None
    content: Optional[str] = None
    document_type: Optional[str] = None
    format: Optional[str] = None
    version: Optional[str] = None
    author: Optional[str] = None