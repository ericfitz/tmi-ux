// This project uses vitest for all unit tests, with native vitest syntax.
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project.

import '@angular/compiler';

import { vi, describe, it, expect, beforeEach } from 'vitest';

import { MetadataDialogComponent, MetadataDialogData } from './metadata-dialog.component';
import type { Metadata } from '../../models/threat-model.model';

describe('MetadataDialogComponent', () => {
  let mockDialogRef: { close: ReturnType<typeof vi.fn> };

  // SEM@417a9151d82d6abf834b61ca217dace46154b149: construct and initialize MetadataDialogComponent with given data for tests (pure)
  function build(data: MetadataDialogData): MetadataDialogComponent {
    const component = new MetadataDialogComponent(mockDialogRef as never, data);
    component.ngOnInit();
    return component;
  }

  const metadata: Metadata[] = [
    { key: 'env', value: 'prod' },
    { key: 'owner', value: 'team-a' },
  ];

  beforeEach(() => {
    mockDialogRef = { close: vi.fn() };
  });

  describe('initialization', () => {
    it('should create', () => {
      expect(build({ metadata: [] })).toBeTruthy();
    });

    it('copies the provided metadata into the data source', () => {
      const component = build({ metadata });

      expect(component.dataSource.data).toEqual(metadata);
      // It is a copy, not the same array reference.
      expect(component.dataSource.data).not.toBe(metadata);
    });

    it('shows the actions column when editable', () => {
      const component = build({ metadata, isReadOnly: false });

      expect(component.displayedColumns).toEqual(['key', 'value', 'actions']);
    });

    it('hides the actions column in read-only mode', () => {
      const component = build({ metadata, isReadOnly: true });

      expect(component.displayedColumns).toEqual(['key', 'value']);
    });
  });

  describe('addItem', () => {
    it('appends an empty key/value row', () => {
      const component = build({ metadata: [] });

      component.addItem();

      expect(component.dataSource.data).toEqual([{ key: '', value: '' }]);
    });
  });

  describe('deleteItem', () => {
    it('removes the row at the given index', () => {
      const component = build({ metadata });

      component.deleteItem(0);

      expect(component.dataSource.data).toEqual([{ key: 'owner', value: 'team-a' }]);
    });

    it('ignores an out-of-range index', () => {
      const component = build({ metadata });

      component.deleteItem(99);
      component.deleteItem(-1);

      expect(component.dataSource.data).toHaveLength(2);
    });
  });

  describe('save', () => {
    it('closes the dialog with the valid metadata entries', () => {
      const component = build({ metadata });

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith(metadata);
    });

    it('filters out entries with an empty or whitespace-only key or value', () => {
      const component = build({
        metadata: [
          { key: 'good', value: 'value' },
          { key: '', value: 'orphan-value' },
          { key: 'orphan-key', value: '' },
          { key: '  ', value: '  ' },
        ],
      });

      component.save();

      expect(mockDialogRef.close).toHaveBeenCalledWith([{ key: 'good', value: 'value' }]);
    });
  });

  describe('cancel', () => {
    it('closes the dialog without a result', () => {
      const component = build({ metadata });

      component.cancel();

      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });
  });

  describe('tab index helpers', () => {
    it('computes add/cancel/save tab indices from the row count', () => {
      const component = build({ metadata }); // 2 rows

      // base = rows * 3 = 6
      expect(component.getAddButtonTabIndex()).toBe(7);
      expect(component.getCancelButtonTabIndex()).toBe(8);
      expect(component.getSaveButtonTabIndex()).toBe(9);
    });
  });
});
