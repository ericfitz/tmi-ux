/**
 * Internal reference consistency validator
 * Validates that all internal references within a ThreatModel are consistent
 */

import { ReferenceValidator, ValidationError, ValidationContext } from './types';
import { BaseValidator, ValidationUtils } from './base-validator';

/**
 * Validates internal reference consistency within a ThreatModel
 */
export class InternalReferenceValidator extends BaseValidator implements ReferenceValidator {
  
  /**
   * Validate that all references are consistent within the threat model
   */
  validateReferences(threatModel: any, context: ValidationContext): ValidationError[] {
    this.clearErrors();

    if (!threatModel || typeof threatModel !== 'object') {
      this.addError(ValidationUtils.createError(
        'INVALID_THREAT_MODEL',
        'ThreatModel must be a valid object for reference validation',
        context.currentPath
      ));
      return this.getResults().errors;
    }

    // Build reference maps
    const referenceMap = this.buildReferenceMap(threatModel, context);

    // Validate threat references
    this.validateThreatReferences(threatModel, referenceMap, context);

    // Validate document references (if any custom references exist)
    this.validateDocumentReferences(threatModel, referenceMap, context);

    // Validate diagram internal consistency
    this.validateDiagramInternalReferences(threatModel, referenceMap, context);

    // Validate cross-references between different entities
    this.validateCrossReferences(threatModel, referenceMap, context);

    return this.getResults().errors;
  }

  /**
   * Build a map of all available references in the threat model
   */
  private buildReferenceMap(threatModel: any, _context: ValidationContext): ReferenceMap {
    const referenceMap: ReferenceMap = {
      threatModelId: threatModel.id,
      diagramIds: new Set(),
      cellIds: new Map(), // diagram_id -> Set<cell_id>
      documentIds: new Set(),
      threatIds: new Set(),
      userIds: new Set(),
    };

    // Collect diagram IDs and cell IDs
    if (Array.isArray(threatModel.diagrams)) {
      threatModel.diagrams.forEach((diagram: any) => {
        if (diagram?.id) {
          referenceMap.diagramIds.add(diagram.id);
          
          // Collect cell IDs for this diagram
          if (Array.isArray(diagram.cells)) {
            const cellIds = new Set<string>();
            diagram.cells.forEach((cell: any) => {
              if (cell?.id) {
                cellIds.add(cell.id);
              }
            });
            referenceMap.cellIds.set(diagram.id, cellIds);
          }
        }
      });
    }

    // Collect document IDs
    if (Array.isArray(threatModel.documents)) {
      threatModel.documents.forEach((document: any) => {
        if (document?.id) {
          referenceMap.documentIds.add(document.id);
        }
      });
    }

    // Collect threat IDs
    if (Array.isArray(threatModel.threats)) {
      threatModel.threats.forEach((threat: any) => {
        if (threat?.id) {
          referenceMap.threatIds.add(threat.id);
        }
      });
    }

    // Collect user IDs from authorization
    if (Array.isArray(threatModel.authorization)) {
      threatModel.authorization.forEach((auth: any) => {
        if (auth?.subject) {
          referenceMap.userIds.add(auth.subject);
        }
      });
    }

    // Add owner and creator
    if (threatModel.owner) {
      referenceMap.userIds.add(threatModel.owner);
    }
    if (threatModel.created_by) {
      referenceMap.userIds.add(threatModel.created_by);
    }

    return referenceMap;
  }

  /**
   * Validate threat references to diagrams and cells
   */
  private validateThreatReferences(
    threatModel: any,
    referenceMap: ReferenceMap,
    context: ValidationContext
  ): void {
    if (!Array.isArray(threatModel.threats)) return;

    threatModel.threats.forEach((threat: any, index: number) => {
      const threatPath = ValidationUtils.buildPath(
        ValidationUtils.buildPath(context.currentPath, 'threats'),
        index
      );

      // Validate threat_model_id reference
      if (threat?.threat_model_id && threat.threat_model_id !== referenceMap.threatModelId) {
        this.addError(ValidationUtils.createError(
          'INVALID_THREAT_MODEL_REFERENCE',
          `Threat references invalid threat_model_id '${threat.threat_model_id}', expected '${referenceMap.threatModelId}'`,
          ValidationUtils.buildPath(threatPath, 'threat_model_id'),
          'error',
          { 
            expected: referenceMap.threatModelId,
            actual: threat.threat_model_id 
          }
        ));
      }

      // Validate diagram_id reference
      if (threat?.diagram_id) {
        if (!referenceMap.diagramIds.has(threat.diagram_id)) {
          this.addError(ValidationUtils.createError(
            'INVALID_DIAGRAM_REFERENCE',
            `Threat references non-existent diagram '${threat.diagram_id}'`,
            ValidationUtils.buildPath(threatPath, 'diagram_id'),
            'error',
            { 
              invalidDiagramId: threat.diagram_id,
              availableDiagramIds: Array.from(referenceMap.diagramIds)
            }
          ));
        } else {
          // Validate cell_id reference within the diagram
          if (threat?.cell_id) {
            const cellIds = referenceMap.cellIds.get(threat.diagram_id);
            if (cellIds && !cellIds.has(threat.cell_id)) {
              this.addError(ValidationUtils.createError(
                'INVALID_CELL_REFERENCE',
                `Threat references non-existent cell '${threat.cell_id}' in diagram '${threat.diagram_id}'`,
                ValidationUtils.buildPath(threatPath, 'cell_id'),
                'error',
                { 
                  invalidCellId: threat.cell_id,
                  diagramId: threat.diagram_id,
                  availableCellIds: Array.from(cellIds)
                }
              ));
            }
          }
        }
      } else if (threat?.cell_id) {
        // Cell ID specified without diagram ID
        this.addError(ValidationUtils.createError(
          'ORPHANED_CELL_REFERENCE',
          `Threat specifies cell_id '${threat.cell_id}' without corresponding diagram_id`,
          ValidationUtils.buildPath(threatPath, 'cell_id'),
          'warning',
          { orphanedCellId: threat.cell_id }
        ));
      }
    });
  }

  /**
   * Validate document references (if any custom linking exists)
   */
  private validateDocumentReferences(
    threatModel: any,
    referenceMap: ReferenceMap,
    context: ValidationContext
  ): void {
    // Currently documents don't have outbound references, but this method
    // can be extended if document linking features are added in the future
    
    // Check for any metadata that might reference other entities
    if (Array.isArray(threatModel.documents)) {
      threatModel.documents.forEach((document: any, index: number) => {
        if (Array.isArray(document?.metadata)) {
          const documentPath = ValidationUtils.buildPath(
            ValidationUtils.buildPath(context.currentPath, 'documents'),
            index
          );
          
          this.validateMetadataReferences(
            document.metadata,
            referenceMap,
            ValidationUtils.buildPath(documentPath, 'metadata')
          );
        }
      });
    }
  }

  /**
   * Validate diagram internal references and consistency
   */
  private validateDiagramInternalReferences(
    threatModel: any,
    referenceMap: ReferenceMap,
    context: ValidationContext
  ): void {
    if (!Array.isArray(threatModel.diagrams)) return;

    threatModel.diagrams.forEach((diagram: any, index: number) => {
      const diagramPath = ValidationUtils.buildPath(
        ValidationUtils.buildPath(context.currentPath, 'diagrams'),
        index
      );

      // Validate diagram metadata references
      if (Array.isArray(diagram?.metadata)) {
        this.validateMetadataReferences(
          diagram.metadata,
          referenceMap,
          ValidationUtils.buildPath(diagramPath, 'metadata')
        );
      }

      // Cell reference validation is handled by diagram-specific validators
      // This is just for additional cross-diagram validation if needed
    });
  }

  /**
   * Validate cross-references between different entity types
   */
  private validateCrossReferences(
    threatModel: any,
    referenceMap: ReferenceMap,
    context: ValidationContext
  ): void {
    // Validate that the owner exists in authorization
    if (threatModel.owner && !referenceMap.userIds.has(threatModel.owner)) {
      this.addError(ValidationUtils.createError(
        'OWNER_NOT_IN_AUTHORIZATION',
        `ThreatModel owner '${threatModel.owner}' is not present in authorization list`,
        ValidationUtils.buildPath(context.currentPath, 'owner'),
        'warning',
        { 
          owner: threatModel.owner,
          authorizedUsers: Array.from(referenceMap.userIds)
        }
      ));
    }

    // Validate that created_by exists in current authorization (warning only)
    if (threatModel.created_by && !referenceMap.userIds.has(threatModel.created_by)) {
      this.addError(ValidationUtils.createError(
        'CREATOR_NOT_IN_AUTHORIZATION',
        `ThreatModel creator '${threatModel.created_by}' is not present in current authorization list`,
        ValidationUtils.buildPath(context.currentPath, 'created_by'),
        'info',
        { 
          creator: threatModel.created_by,
          authorizedUsers: Array.from(referenceMap.userIds)
        }
      ));
    }

    // Check for orphaned threats (threats without associated diagrams)
    this.validateOrphanedThreats(threatModel, referenceMap, context);
  }

  /**
   * Validate metadata for potential references to other entities
   */
  private validateMetadataReferences(
    metadata: any[],
    referenceMap: ReferenceMap,
    basePath: string
  ): void {
    // This method can be extended to validate metadata that contains
    // references to other entities (e.g., threat IDs, diagram IDs)
    
    metadata.forEach((item: any, index: number) => {
      if (item?.key && item?.value) {
        const metadataPath = ValidationUtils.buildPath(basePath, index);
        
        // Example: Check for potential UUID references in metadata values
        if (ValidationUtils.isValidUUID(item.value)) {
          // This could be a reference to another entity
          // Add specific validation logic based on metadata key patterns
          if (item.key.toLowerCase().includes('threat') && 
              !referenceMap.threatIds.has(item.value)) {
            this.addError(ValidationUtils.createError(
              'POTENTIAL_INVALID_THREAT_REFERENCE',
              `Metadata value '${item.value}' appears to be a threat UUID but doesn't match any existing threat`,
              ValidationUtils.buildPath(metadataPath, 'value'),
              'info',
              { 
                metadataKey: item.key,
                potentialReference: item.value
              }
            ));
          }
        }
      }
    });
  }

  /**
   * Check for threats that don't reference any diagram
   */
  private validateOrphanedThreats(
    threatModel: any,
    referenceMap: ReferenceMap,
    context: ValidationContext
  ): void {
    if (!Array.isArray(threatModel.threats)) return;

    const orphanedThreats = threatModel.threats.filter((threat: any) => 
      !threat?.diagram_id && referenceMap.diagramIds.size > 0
    );

    if (orphanedThreats.length > 0) {
      const threatNames = orphanedThreats.map((t: any) => t?.name || t?.id || 'unknown').join(', ');
      this.addError(ValidationUtils.createError(
        'ORPHANED_THREATS',
        `Found ${orphanedThreats.length} threats not associated with any diagram: ${threatNames}`,
        ValidationUtils.buildPath(context.currentPath, 'threats'),
        'info',
        { 
          orphanedCount: orphanedThreats.length,
          totalDiagrams: referenceMap.diagramIds.size
        }
      ));
    }
  }
}

/**
 * Internal reference map for tracking available entities
 */
interface ReferenceMap {
  threatModelId: string;
  diagramIds: Set<string>;
  cellIds: Map<string, Set<string>>; // diagram_id -> cell_ids
  documentIds: Set<string>;
  threatIds: Set<string>;
  userIds: Set<string>;
}