# PDF Report Diagram Rendering - Medium-Term Implementation Design

## Overview

This document outlines the design for implementing pre-rendered diagram storage to enable full diagram inclusion in PDF reports. This approach will replace the current placeholder implementation with actual rendered diagram images.

## Current State

**Problem**: PDF reports currently show diagram placeholders because:

- `X6GraphAdapter` is not available in threat model context
- We want to avoid duplicating rendering logic
- Diagram rendering requires complex X6 dependencies

**Current Implementation**: Placeholder text showing diagram name and ID

## Proposed Solution: Pre-Rendered Diagram Storage

### Core Concept

Store rendered PNG/SVG versions of diagrams when they are created or modified in the DFD editor. PDF reports will use these pre-stored images instead of rendering diagrams at report generation time.

## Implementation Plan

### Phase 1: Data Model Updates

#### 1.1 Update Diagram Model

**File**: `src/app/pages/tm/models/diagram.model.ts`

```typescript
export interface Diagram {
  id: string;
  name: string;
  // ... existing fields

  // New fields for pre-rendered storage
  renderedImage?: {
    png: string; // Base64 encoded PNG data
    svg?: string; // Optional SVG data
    thumbnail?: string; // Optional thumbnail for UI
    lastRendered: string; // ISO timestamp
    renderDimensions: {
      width: number;
      height: number;
    };
  };
}
```

#### 1.2 Update API Specification

**File**: `shared-api/api-specs/tmi-openapi.json`

Add new fields to diagram schema:

- `renderedImage` object with PNG data, metadata, and timestamps
- Consider size limits (base64 PNG can be large)
- Optional compression/optimization parameters

### Phase 2: DFD Editor Integration

#### 2.1 Diagram Export Service Enhancement

**File**: `src/app/pages/dfd/services/dfd-export.service.ts`

Add new method for internal rendering (non-user-initiated):

```typescript
public async renderDiagramForStorage(
  threatModelName?: string,
  diagramName?: string
): Promise<DiagramRenderResult> {
  // Similar to exportDiagram but returns data instead of saving file
  // Returns { pngData: string, svgData?: string, dimensions: {...} }
}
```

#### 2.2 Auto-Render on Save

**File**: `src/app/pages/dfd/dfd.component.ts` or diagram save workflow

```typescript
private async saveDiagramWithRendering(): Promise<void> {
  // 1. Save diagram data as usual
  await this.saveDiagram();

  // 2. Render diagram for storage
  const renderResult = await this.dfdExportService.renderDiagramForStorage(
    this.threatModel?.name,
    this.diagram?.name
  );

  // 3. Update diagram with rendered data
  if (this.diagram) {
    this.diagram.renderedImage = {
      png: renderResult.pngData,
      svg: renderResult.svgData,
      lastRendered: new Date().toISOString(),
      renderDimensions: renderResult.dimensions
    };

    // 4. Save updated diagram
    await this.saveDiagramRendering(this.diagram);
  }
}
```

#### 2.3 Render Triggers

Trigger re-rendering when:

- Diagram is saved after modifications
- Nodes/edges are added, removed, or modified
- Diagram layout changes significantly
- Manual "re-render for reports" action

### Phase 3: Storage and API Integration

#### 3.1 Backend API Endpoints

Add new endpoints for diagram rendering data:

```
PUT /threat_models/{id}/diagrams/{diagram_id}/rendering
GET /threat_models/{id}/diagrams/{diagram_id}/rendering
DELETE /threat_models/{id}/diagrams/{diagram_id}/rendering
```

#### 3.2 Storage Considerations

**Size Management**:

- Typical PNG: 100KB - 2MB depending on complexity
- Consider image compression/optimization
- Optional thumbnail generation (e.g., 200x150px preview)
- Storage quota per threat model

**Performance**:

- Lazy loading of rendered images
- Cache management for frequently accessed diagrams
- Background rendering for non-blocking UX

### Phase 4: PDF Report Service Updates

#### 4.1 Enhanced Diagram Rendering

**File**: `src/app/pages/tm/services/threat-model-report.service.ts`

```typescript
private async renderDiagrams(threatModel: ThreatModel): Promise<DiagramImage[]> {
  const diagramImages: DiagramImage[] = [];

  if (!threatModel.diagrams?.length) {
    return diagramImages;
  }

  for (const diagram of threatModel.diagrams) {
    if (diagram.renderedImage?.png) {
      // Use pre-rendered image
      diagramImages.push({
        diagramId: diagram.id,
        diagramName: diagram.name || 'Untitled Diagram',
        imageData: diagram.renderedImage.png, // Already base64 encoded
      });
    } else {
      // Fallback to placeholder or trigger re-rendering
      this.logger.warn('No pre-rendered image available for diagram', {
        diagramId: diagram.id
      });

      diagramImages.push({
        diagramId: diagram.id,
        diagramName: diagram.name || 'Untitled Diagram',
        imageData: '', // Will show placeholder
      });
    }
  }

  return diagramImages;
}
```

#### 4.2 Graceful Fallback

Handle cases where pre-rendered images aren't available:

- Show informative placeholder
- Option to trigger re-rendering from report context
- Clear messaging about diagram availability

### Phase 5: User Experience Enhancements

#### 5.1 Rendering Status Indicators

**DFD Editor**:

- Show "rendering status" indicator (✅ up-to-date, ⏳ rendering, ⚠️ needs update)
- Manual "Update Report Preview" button
- Estimated file size impact

#### 5.2 Report Generation Options

**PDF Report Service**:

- Option to include/exclude diagrams
- Quality settings (full/thumbnail/placeholder)
- Async report generation for large threat models

#### 5.3 Diagnostic Tools

**Admin/Debug Features**:

- View rendering status for all diagrams
- Bulk re-rendering capabilities
- Storage usage reporting

## Implementation Considerations

### Technical Challenges

1. **Storage Size**: Base64 PNG data can be large (1-2MB per diagram)
2. **Sync Timing**: Ensuring renders complete before PDF generation
3. **Version Control**: Handling diagram changes vs. stored renders
4. **Memory Usage**: Loading multiple large images for PDF generation

### Proposed Solutions

1. **Compression**: Implement PNG optimization and optional JPEG conversion
2. **Async Rendering**: Non-blocking background rendering with status tracking
3. **Cache Invalidation**: Smart re-rendering based on diagram modification timestamps
4. **Progressive Loading**: Load images only when needed for PDF generation

### Migration Strategy

1. **Backward Compatibility**: Support threat models without pre-rendered images
2. **Gradual Rollout**: Enable feature per threat model or user preference
3. **Bulk Processing**: Tool to pre-render existing diagrams

## Success Metrics

- **Functionality**: PDF reports include actual diagram images
- **Performance**: Report generation <5 seconds for typical threat models
- **Storage**: <50MB additional storage per threat model on average
- **User Experience**: No manual steps required for diagram inclusion

## Future Enhancements

1. **Multiple Formats**: Support for SVG, high-DPI rendering
2. **Dynamic Sizing**: Optimize diagram size for PDF layout
3. **Batch Processing**: Background rendering queue
4. **Cloud Storage**: External storage for rendered images
5. **Version History**: Keep multiple rendered versions

## Migration from Placeholder Implementation

1. Deploy data model updates
2. Enable rendering in DFD editor (feature flag)
3. Update PDF service to use pre-rendered images
4. Remove placeholder logic
5. Add user controls for rendering management

This design provides a scalable, maintainable solution for including rendered diagrams in PDF reports while maintaining clean separation between the DFD and TM modules.
