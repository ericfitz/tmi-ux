import { Cell } from '@antv/x6';

// Extend the X6 Cell interface to include our custom methods
declare module '@antv/x6' {
  interface Cell {
    // Metadata management methods
    getMetadataValue(key: string): string | undefined;
    setMetadataValue(key: string, value: string): void;
    removeMetadataKey(key: string): void;
    getMetadataAsObject(): Record<string, string>;

    // Unified label handling methods
    getLabel(): string;
    setLabel(label: string): void;
  }
}

// Extend Cell.Properties interface separately
declare module '@antv/x6/lib/model/cell' {
  interface Properties {
    type?: string;
    metadata?: Array<{ key: string; value: string }>;
  }
}

/**
 * Initialize X6 Cell prototype extensions
 * This function must be called once during application startup
 */
export function initializeX6CellExtensions(): void {
  // Metadata management methods
  Cell.prototype.getMetadataValue = function (key: string): string | undefined {
    const metadata = this.prop('metadata') as Array<{ key: string; value: string }> | undefined;
    return metadata?.find(item => item.key === key)?.value;
  };

  Cell.prototype.setMetadataValue = function (key: string, value: string): void {
    let metadata = this.prop('metadata') as Array<{ key: string; value: string }> | undefined;

    if (!metadata) {
      metadata = [];
    } else {
      // Create a copy to avoid mutation
      metadata = [...metadata];
    }

    const existingIndex = metadata.findIndex(item => item.key === key);
    if (existingIndex >= 0) {
      metadata[existingIndex] = { key, value };
    } else {
      metadata.push({ key, value });
    }

    this.prop('metadata', metadata);
  };

  Cell.prototype.removeMetadataKey = function (key: string): void {
    const metadata = this.prop('metadata') as Array<{ key: string; value: string }> | undefined;
    if (!metadata) return;

    const filteredMetadata = metadata.filter(item => item.key !== key);
    this.prop('metadata', filteredMetadata);
  };

  Cell.prototype.getMetadataAsObject = function (): Record<string, string> {
    const metadata = this.prop('metadata') as Array<{ key: string; value: string }> | undefined;
    if (!metadata) return {};

    return metadata.reduce(
      (obj, item) => {
        obj[item.key] = item.value;
        return obj;
      },
      {} as Record<string, string>,
    );
  };

  // Unified label handling methods
  Cell.prototype.getLabel = function (): string {
    if (this.isNode()) {
      // For nodes, get label from attrs.text.text
      return this.getAttrByPath('text/text') || '';
    } else if (this.isEdge()) {
      // For edges, get label from the first label
      const labels = (this as any).getLabels();
      return labels.length > 0 ? (labels[0].attrs?.['text']?.['text'] as string) || '' : '';
    }
    return '';
  };

  Cell.prototype.setLabel = function (label: string): void {
    if (this.isNode()) {
      // For nodes, set label in attrs.text.text
      this.setAttrByPath('text/text', label);
    } else if (this.isEdge()) {
      // For edges, set label in the first label or create one
      const labels = (this as any).getLabels();

      if (labels.length > 0) {
        // Update existing label
        const updatedLabel = {
          ...labels[0],
          attrs: {
            ...labels[0].attrs,
            ['text']: {
              ...labels[0].attrs?.['text'],
              text: label,
            },
          },
        };
        (this as any).setLabelAt(0, updatedLabel);
      } else {
        // Create new label
        (this as any).appendLabel({
          attrs: {
            ['text']: {
              text: label,
            },
          },
        });
      }
    }
  };
}
