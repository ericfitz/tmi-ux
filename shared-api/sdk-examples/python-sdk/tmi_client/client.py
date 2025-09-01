"""
Main TMI API client class.
"""

import requests
from typing import Optional, Dict, List, Any, Union
from urllib.parse import urljoin
import json

from .auth.oauth import OAuthHandler
from .models.threat_model import ThreatModel
from .models.diagram import Diagram
from .models.threat import Threat
from .models.document import Document
from .models.source import Source


class TMIClient:
    """Main client for interacting with the TMI API."""

    def __init__(self, base_url: str, token: Optional[str] = None):
        """
        Initialize the TMI client.

        Args:
            base_url: Base URL of the TMI API server
            token: Optional JWT token for authentication
        """
        self.base_url = base_url.rstrip("/")
        self.token = token
        self.session = requests.Session()
        self.auth_handler = OAuthHandler(self)

        if token:
            self.session.headers.update({"Authorization": f"Bearer {token}"})

    def set_token(self, token: str) -> None:
        """Set the JWT token for authentication."""
        self.token = token
        self.session.headers.update({"Authorization": f"Bearer {token}"})

    def _request(self, method: str, path: str, **kwargs) -> requests.Response:
        """Make an authenticated request to the API."""
        url = urljoin(self.base_url + "/", path.lstrip("/"))
        response = self.session.request(method, url, **kwargs)
        response.raise_for_status()
        return response

    def _get(self, path: str, **kwargs) -> requests.Response:
        """Make a GET request."""
        return self._request("GET", path, **kwargs)

    def _post(self, path: str, **kwargs) -> requests.Response:
        """Make a POST request."""
        return self._request("POST", path, **kwargs)

    def _put(self, path: str, **kwargs) -> requests.Response:
        """Make a PUT request."""
        return self._request("PUT", path, **kwargs)

    def _patch(self, path: str, **kwargs) -> requests.Response:
        """Make a PATCH request."""
        return self._request("PATCH", path, **kwargs)

    def _delete(self, path: str, **kwargs) -> requests.Response:
        """Make a DELETE request."""
        return self._request("DELETE", path, **kwargs)

    # Authentication methods
    def get_auth_providers(self) -> List[Dict[str, Any]]:
        """Get list of available OAuth providers."""
        response = self._get("/oauth2/providers")
        return response.json()

    def get_current_user(self) -> Dict[str, Any]:
        """Get current authenticated user information."""
        response = self._get("/oauth2/userinfo")
        return response.json()

    def refresh_token(self) -> Dict[str, Any]:
        """Refresh the current JWT token."""
        response = self._post("/oauth2/refresh")
        token_data = response.json()
        if "access_token" in token_data:
            self.set_token(token_data["access_token"])
        return token_data

    def logout(self) -> None:
        """Logout and invalidate the current session."""
        self._post("/oauth2/revoke")
        self.token = None
        if "Authorization" in self.session.headers:
            del self.session.headers["Authorization"]

    # Threat Model operations
    def list_threat_models(
        self, limit: Optional[int] = None, offset: Optional[int] = None
    ) -> List[ThreatModel]:
        """List all threat models."""
        params = {}
        if limit is not None:
            params["limit"] = limit
        if offset is not None:
            params["offset"] = offset

        response = self._get("/threat_models", params=params)
        return [ThreatModel.from_dict(tm) for tm in response.json()]

    def get_threat_model(self, threat_model_id: str) -> ThreatModel:
        """Get a specific threat model by ID."""
        response = self._get(f"/threat_models/{threat_model_id}")
        return ThreatModel.from_dict(response.json())

    def create_threat_model(
        self, threat_model: Union[ThreatModel, Dict[str, Any]]
    ) -> ThreatModel:
        """Create a new threat model."""
        data = (
            threat_model.to_dict()
            if isinstance(threat_model, ThreatModel)
            else threat_model
        )
        response = self._post("/threat_models", json=data)
        return ThreatModel.from_dict(response.json())

    def update_threat_model(
        self, threat_model_id: str, threat_model: Union[ThreatModel, Dict[str, Any]]
    ) -> ThreatModel:
        """Update a threat model."""
        data = (
            threat_model.to_dict()
            if isinstance(threat_model, ThreatModel)
            else threat_model
        )
        response = self._put(f"/threat_models/{threat_model_id}", json=data)
        return ThreatModel.from_dict(response.json())

    def patch_threat_model(
        self, threat_model_id: str, patches: List[Dict[str, Any]]
    ) -> ThreatModel:
        """Apply JSON Patch operations to a threat model."""
        response = self._patch(f"/threat_models/{threat_model_id}", json=patches)
        return ThreatModel.from_dict(response.json())

    def delete_threat_model(self, threat_model_id: str) -> None:
        """Delete a threat model."""
        self._delete(f"/threat_models/{threat_model_id}")

    # Diagram operations
    def list_diagrams(self, threat_model_id: str) -> List[Diagram]:
        """List all diagrams for a threat model."""
        response = self._get(f"/threat_models/{threat_model_id}/diagrams")
        return [Diagram.from_dict(diagram) for diagram in response.json()]

    def get_diagram(self, threat_model_id: str, diagram_id: str) -> Diagram:
        """Get a specific diagram."""
        response = self._get(f"/threat_models/{threat_model_id}/diagrams/{diagram_id}")
        return Diagram.from_dict(response.json())

    def create_diagram(
        self, threat_model_id: str, diagram: Union[Diagram, Dict[str, Any]]
    ) -> Diagram:
        """Create a new diagram."""
        data = diagram.to_dict() if isinstance(diagram, Diagram) else diagram
        response = self._post(f"/threat_models/{threat_model_id}/diagrams", json=data)
        return Diagram.from_dict(response.json())

    def update_diagram(
        self,
        threat_model_id: str,
        diagram_id: str,
        diagram: Union[Diagram, Dict[str, Any]],
    ) -> Diagram:
        """Update a diagram."""
        data = diagram.to_dict() if isinstance(diagram, Diagram) else diagram
        response = self._put(
            f"/threat_models/{threat_model_id}/diagrams/{diagram_id}", json=data
        )
        return Diagram.from_dict(response.json())

    def patch_diagram(
        self, threat_model_id: str, diagram_id: str, patches: List[Dict[str, Any]]
    ) -> Diagram:
        """Apply JSON Patch operations to a diagram."""
        response = self._patch(
            f"/threat_models/{threat_model_id}/diagrams/{diagram_id}", json=patches
        )
        return Diagram.from_dict(response.json())

    def delete_diagram(self, threat_model_id: str, diagram_id: str) -> None:
        """Delete a diagram."""
        self._delete(f"/threat_models/{threat_model_id}/diagrams/{diagram_id}")

    # Collaboration operations
    def get_collaboration_status(
        self, threat_model_id: str, diagram_id: str
    ) -> Dict[str, Any]:
        """Get collaboration status for a diagram."""
        response = self._get(
            f"/threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate"
        )
        return response.json()

    def start_collaboration(
        self, threat_model_id: str, diagram_id: str
    ) -> Dict[str, Any]:
        """Start a collaboration session for a diagram."""
        response = self._post(
            f"/threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate"
        )
        return response.json()

    def end_collaboration(self, threat_model_id: str, diagram_id: str) -> None:
        """End a collaboration session for a diagram."""
        self._delete(
            f"/threat_models/{threat_model_id}/diagrams/{diagram_id}/collaborate"
        )

    def get_collaboration_sessions(self) -> List[Dict[str, Any]]:
        """Get all active collaboration sessions."""
        response = self._get("/collaboration/sessions")
        return response.json()

    # Threat operations
    def list_threats(self, threat_model_id: str) -> List[Threat]:
        """List all threats for a threat model."""
        response = self._get(f"/threat_models/{threat_model_id}/threats")
        return [Threat.from_dict(threat) for threat in response.json()]

    def get_threat(self, threat_model_id: str, threat_id: str) -> Threat:
        """Get a specific threat."""
        response = self._get(f"/threat_models/{threat_model_id}/threats/{threat_id}")
        return Threat.from_dict(response.json())

    def create_threat(
        self, threat_model_id: str, threat: Union[Threat, Dict[str, Any]]
    ) -> Threat:
        """Create a new threat."""
        data = threat.to_dict() if isinstance(threat, Threat) else threat
        response = self._post(f"/threat_models/{threat_model_id}/threats", json=data)
        return Threat.from_dict(response.json())

    def update_threat(
        self,
        threat_model_id: str,
        threat_id: str,
        threat: Union[Threat, Dict[str, Any]],
    ) -> Threat:
        """Update a threat."""
        data = threat.to_dict() if isinstance(threat, Threat) else threat
        response = self._put(
            f"/threat_models/{threat_model_id}/threats/{threat_id}", json=data
        )
        return Threat.from_dict(response.json())

    def patch_threat(
        self, threat_model_id: str, threat_id: str, patches: List[Dict[str, Any]]
    ) -> Threat:
        """Apply JSON Patch operations to a threat."""
        response = self._patch(
            f"/threat_models/{threat_model_id}/threats/{threat_id}", json=patches
        )
        return Threat.from_dict(response.json())

    def delete_threat(self, threat_model_id: str, threat_id: str) -> None:
        """Delete a threat."""
        self._delete(f"/threat_models/{threat_model_id}/threats/{threat_id}")

    def create_threats_bulk(
        self, threat_model_id: str, threats: List[Union[Threat, Dict[str, Any]]]
    ) -> List[Threat]:
        """Create multiple threats in bulk."""
        data = [
            threat.to_dict() if isinstance(threat, Threat) else threat
            for threat in threats
        ]
        response = self._post(
            f"/threat_models/{threat_model_id}/threats/bulk", json=data
        )
        return [Threat.from_dict(threat) for threat in response.json()]

    def update_threats_bulk(
        self, threat_model_id: str, threats: List[Union[Threat, Dict[str, Any]]]
    ) -> List[Threat]:
        """Update multiple threats in bulk."""
        data = [
            threat.to_dict() if isinstance(threat, Threat) else threat
            for threat in threats
        ]
        response = self._put(
            f"/threat_models/{threat_model_id}/threats/bulk", json=data
        )
        return [Threat.from_dict(threat) for threat in response.json()]

    def delete_threats_batch(
        self, threat_model_id: str, threat_ids: List[str]
    ) -> Dict[str, Any]:
        """Delete multiple threats in a batch."""
        response = self._delete(
            f"/threat_models/{threat_model_id}/threats/batch",
            json={"threat_ids": threat_ids},
        )
        return response.json()

    def patch_threats_batch(
        self, threat_model_id: str, patches: List[Dict[str, Any]]
    ) -> List[Threat]:
        """Apply patches to multiple threats in a batch."""
        response = self._post(
            f"/threat_models/{threat_model_id}/threats/batch/patch", json=patches
        )
        return [Threat.from_dict(threat) for threat in response.json()]

    # Document operations
    def list_documents(self, threat_model_id: str) -> List[Document]:
        """List all documents for a threat model."""
        response = self._get(f"/threat_models/{threat_model_id}/documents")
        return [Document.from_dict(doc) for doc in response.json()]

    def get_document(self, threat_model_id: str, document_id: str) -> Document:
        """Get a specific document."""
        response = self._get(
            f"/threat_models/{threat_model_id}/documents/{document_id}"
        )
        return Document.from_dict(response.json())

    def create_document(
        self, threat_model_id: str, document: Union[Document, Dict[str, Any]]
    ) -> Document:
        """Create a new document."""
        data = document.to_dict() if isinstance(document, Document) else document
        response = self._post(f"/threat_models/{threat_model_id}/documents", json=data)
        return Document.from_dict(response.json())

    def update_document(
        self,
        threat_model_id: str,
        document_id: str,
        document: Union[Document, Dict[str, Any]],
    ) -> Document:
        """Update a document."""
        data = document.to_dict() if isinstance(document, Document) else document
        response = self._put(
            f"/threat_models/{threat_model_id}/documents/{document_id}", json=data
        )
        return Document.from_dict(response.json())

    def delete_document(self, threat_model_id: str, document_id: str) -> None:
        """Delete a document."""
        self._delete(f"/threat_models/{threat_model_id}/documents/{document_id}")

    def create_documents_bulk(
        self, threat_model_id: str, documents: List[Union[Document, Dict[str, Any]]]
    ) -> List[Document]:
        """Create multiple documents in bulk."""
        data = [
            doc.to_dict() if isinstance(doc, Document) else doc for doc in documents
        ]
        response = self._post(
            f"/threat_models/{threat_model_id}/documents/bulk", json=data
        )
        return [Document.from_dict(doc) for doc in response.json()]

    # Source operations
    def list_sources(self, threat_model_id: str) -> List[Source]:
        """List all sources for a threat model."""
        response = self._get(f"/threat_models/{threat_model_id}/sources")
        return [Source.from_dict(source) for source in response.json()]

    def get_source(self, threat_model_id: str, source_id: str) -> Source:
        """Get a specific source."""
        response = self._get(f"/threat_models/{threat_model_id}/sources/{source_id}")
        return Source.from_dict(response.json())

    def create_source(
        self, threat_model_id: str, source: Union[Source, Dict[str, Any]]
    ) -> Source:
        """Create a new source."""
        data = source.to_dict() if isinstance(source, Source) else source
        response = self._post(f"/threat_models/{threat_model_id}/sources", json=data)
        return Source.from_dict(response.json())

    def update_source(
        self,
        threat_model_id: str,
        source_id: str,
        source: Union[Source, Dict[str, Any]],
    ) -> Source:
        """Update a source."""
        data = source.to_dict() if isinstance(source, Source) else source
        response = self._put(
            f"/threat_models/{threat_model_id}/sources/{source_id}", json=data
        )
        return Source.from_dict(response.json())

    def delete_source(self, threat_model_id: str, source_id: str) -> None:
        """Delete a source."""
        self._delete(f"/threat_models/{threat_model_id}/sources/{source_id}")

    def create_sources_bulk(
        self, threat_model_id: str, sources: List[Union[Source, Dict[str, Any]]]
    ) -> List[Source]:
        """Create multiple sources in bulk."""
        data = [
            source.to_dict() if isinstance(source, Source) else source
            for source in sources
        ]
        response = self._post(
            f"/threat_models/{threat_model_id}/sources/bulk", json=data
        )
        return [Source.from_dict(source) for source in response.json()]

    # Metadata operations (generic helper methods)
    def get_metadata(self, path: str) -> Dict[str, Any]:
        """Get metadata for any entity."""
        response = self._get(f"{path}/metadata")
        return response.json()

    def create_metadata_entry(self, path: str, key: str, value: Any) -> Dict[str, Any]:
        """Create a metadata entry."""
        response = self._post(f"{path}/metadata", json={key: value})
        return response.json()

    def get_metadata_entry(self, path: str, key: str) -> Any:
        """Get a specific metadata entry."""
        response = self._get(f"{path}/metadata/{key}")
        return response.json()

    def update_metadata_entry(self, path: str, key: str, value: Any) -> Dict[str, Any]:
        """Update a metadata entry."""
        response = self._put(f"{path}/metadata/{key}", json=value)
        return response.json()

    def delete_metadata_entry(self, path: str, key: str) -> None:
        """Delete a metadata entry."""
        self._delete(f"{path}/metadata/{key}")

    def update_metadata_bulk(
        self, path: str, metadata: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Update multiple metadata entries in bulk."""
        response = self._post(f"{path}/metadata/bulk", json=metadata)
        return response.json()
