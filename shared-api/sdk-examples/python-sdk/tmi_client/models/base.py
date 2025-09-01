"""
Base model class for TMI entities.
"""
from typing import Dict, Any, Optional
from datetime import datetime
from dataclasses import dataclass, field


@dataclass
class BaseModel:
    """Base class for all TMI data models."""
    
    id: Optional[str] = None
    created_at: Optional[datetime] = None
    modified_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'BaseModel':
        """Create model instance from dictionary."""
        # Parse timestamps
        if 'created_at' in data and data['created_at']:
            data['created_at'] = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
        if 'modified_at' in data and data['modified_at']:
            data['modified_at'] = datetime.fromisoformat(data['modified_at'].replace('Z', '+00:00'))
        
        # Filter out unknown fields and create instance
        known_fields = {f.name for f in cls.__dataclass_fields__.values()}
        filtered_data = {k: v for k, v in data.items() if k in known_fields}
        
        return cls(**filtered_data)
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert model to dictionary."""
        result = {}
        
        for field_name, field_obj in self.__dataclass_fields__.items():
            value = getattr(self, field_name)
            
            if value is None:
                continue
            
            if isinstance(value, datetime):
                result[field_name] = value.isoformat()
            else:
                result[field_name] = value
        
        return result