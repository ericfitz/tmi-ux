import { Injectable } from '@angular/core';

import {
  ThreatModel,
  Metadata,
  Document,
  Repository,
  Note,
  Asset,
  Threat,
} from '../../tm/models/threat-model.model';
import { Diagram } from '../../tm/models/diagram.model';
import {
  ChatContextPayload,
  SerializedEntity,
  EntityType,
  TIMMY_METADATA_KEY,
} from '../models/chat.model';

/**
 * Checks whether an entity is enabled for Timmy chat context.
 * Entities are included by default; they are excluded only when
 * metadata contains { key: "timmy", value: "false" }.
 */
export function isTimmyEnabled(entity: { metadata?: Metadata[] }): boolean {
  const meta = entity.metadata?.find(m => m.key === TIMMY_METADATA_KEY);
  return meta ? meta.value !== 'false' : true;
}

/**
 * Builds the context payload sent to the chat service by serializing
 * threat model entities that are enabled for Timmy.
 */
@Injectable({ providedIn: 'root' })
export class ChatContextBuilderService {
  buildContext(threatModel: ThreatModel): ChatContextPayload {
    const entities: SerializedEntity[] = [
      ...this.serializeDocuments(threatModel.documents ?? []),
      ...this.serializeRepositories(threatModel.repositories ?? []),
      ...this.serializeNotes(threatModel.notes ?? []),
      ...this.serializeAssets(threatModel.assets ?? []),
      ...this.serializeThreats(threatModel.threats ?? []),
      ...this.serializeDiagrams(threatModel.diagrams ?? []),
    ];

    return {
      threatModel: {
        id: threatModel.id,
        name: threatModel.name,
        description: threatModel.description,
        framework: threatModel.threat_model_framework,
      },
      entities,
    };
  }

  private serializeDocuments(docs: Document[]): SerializedEntity[] {
    return docs.filter(isTimmyEnabled).map(d => ({
      type: 'document' as EntityType,
      id: d.id,
      name: d.name,
      summary: [d.description ?? '', `URI: ${d.uri}`].filter(Boolean).join('\n'),
    }));
  }

  private serializeRepositories(repos: Repository[]): SerializedEntity[] {
    return repos.filter(isTimmyEnabled).map(r => {
      const parts = [r.description ?? '', `Type: ${r.type}`, `URI: ${r.uri}`];
      if (r.parameters) {
        parts.push(`Ref: ${r.parameters.refType}/${r.parameters.refValue}`);
        if (r.parameters.subPath) {
          parts.push(`Path: ${r.parameters.subPath}`);
        }
      }
      return {
        type: 'repository' as EntityType,
        id: r.id,
        name: r.name,
        summary: parts.filter(Boolean).join('\n'),
      };
    });
  }

  private serializeNotes(notes: Note[]): SerializedEntity[] {
    return notes.filter(isTimmyEnabled).map(n => ({
      type: 'note' as EntityType,
      id: n.id,
      name: n.name,
      summary: n.content,
    }));
  }

  private serializeAssets(assets: Asset[]): SerializedEntity[] {
    return assets.filter(isTimmyEnabled).map(a => {
      const parts = [a.description ?? '', `Type: ${a.type}`];
      if (a.criticality) parts.push(`Criticality: ${a.criticality}`);
      if (a.sensitivity) parts.push(`Sensitivity: ${a.sensitivity}`);
      if (a.classification?.length) {
        parts.push(`Classification: ${a.classification.join(', ')}`);
      }
      return {
        type: 'asset' as EntityType,
        id: a.id,
        name: a.name,
        summary: parts.filter(Boolean).join('\n'),
      };
    });
  }

  private serializeThreats(threats: Threat[]): SerializedEntity[] {
    return threats.filter(isTimmyEnabled).map(t => {
      const parts = [t.description ?? '', `Type: ${t.threat_type.join(', ')}`];
      if (t.severity) parts.push(`Severity: ${t.severity}`);
      if (t.score != null) parts.push(`Score: ${t.score}`);
      if (t.status) parts.push(`Status: ${t.status}`);
      if (t.mitigated) parts.push('Mitigated: yes');
      if (t.mitigation) parts.push(`Mitigation: ${t.mitigation}`);
      if (t.cwe_id?.length) parts.push(`CWE: ${t.cwe_id.join(', ')}`);
      return {
        type: 'threat' as EntityType,
        id: t.id,
        name: t.name,
        summary: parts.filter(Boolean).join('\n'),
      };
    });
  }

  private serializeDiagrams(diagrams: Diagram[]): SerializedEntity[] {
    return diagrams.filter(isTimmyEnabled).map(d => {
      const cellCount = d.cells?.length ?? 0;
      const parts = [d.description ?? '', `Type: ${d.type}`, `Cells: ${cellCount}`];
      return {
        type: 'diagram' as EntityType,
        id: d.id,
        name: d.name,
        summary: parts.filter(Boolean).join('\n'),
      };
    });
  }
}
