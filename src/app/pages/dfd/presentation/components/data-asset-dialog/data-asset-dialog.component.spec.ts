// This project uses vitest for all unit tests, with native vitest syntax
// This project uses playwright for all integration tests
// Do not use Jasmine or Jest, or Jasmine or Jest syntax anywhere in the project
// Execute all tests using: "pnpm run test"
// Execute this test only using:  "pnpm run test" followed by the relative path to this test file from the project root.
// Do not disable or skip failing tests, ask the user what to do

/**
 * Data Asset Dialog Component Tests
 *
 * Tests to verify the data asset selection dialog functionality including:
 * - Dialog initialization with various data configurations
 * - Asset filtering (only data type assets shown)
 * - Asset validation (handling missing/deleted assets)
 * - Alphabetical sorting of assets
 * - Read-only mode behavior
 * - Dialog result handling
 */

import '@angular/compiler';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DataAssetDialogComponent, DataAssetDialogData } from './data-asset-dialog.component';
import { Asset } from '../../../../tm/models/threat-model.model';

describe('DataAssetDialogComponent', () => {
  let mockDialogRef: any;
  let mockTranslocoService: any;

  const createMockAsset = (id: string, name: string, type: Asset['type'] = 'data'): Asset => ({
    id,
    name,
    type,
    created_at: '2024-01-01T00:00:00Z',
    modified_at: '2024-01-01T00:00:00Z',
  });

  const defaultDialogData: DataAssetDialogData = {
    cellId: 'edge-123',
    currentDataAssetId: undefined,
    assets: [
      createMockAsset('asset-1', 'Customer Data'),
      createMockAsset('asset-2', 'Payment Information'),
      createMockAsset('asset-3', 'API Keys'),
      createMockAsset('asset-4', 'Server Hardware', 'hardware'),
      createMockAsset('asset-5', 'Database Software', 'software'),
    ],
    isReadOnly: false,
  };

  beforeEach(() => {
    mockDialogRef = {
      close: vi.fn(),
    };

    mockTranslocoService = {
      translate: vi.fn((key: string) => {
        const translations: Record<string, string> = {
          'common.none': 'None',
          'dataAssetDialog.selectAsset': 'Data Asset',
          'dataAssetDialog.title.select': 'Select Data Asset',
          'dataAssetDialog.title.view': 'View Data Asset',
        };
        return translations[key] || key;
      }),
    };
  });

  describe('Component Initialization', () => {
    it('should create', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component).toBeTruthy();
    });

    it('should initialize with "None" option first', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetOptions[0].id).toBe(component.NONE_VALUE);
      expect(component.assetOptions[0].name).toBe('None');
    });

    it('should filter assets to only show data type', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      const dataAssets = component.assetOptions.filter(
        option => option.id !== component.NONE_VALUE,
      );
      expect(dataAssets.length).toBe(3); // Only 3 data assets from 5 total
      expect(
        dataAssets.every(option => {
          const asset = defaultDialogData.assets.find(a => a.id === option.id);
          return asset?.type === 'data';
        }),
      ).toBe(true);
    });

    it('should sort assets alphabetically by name', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      const dataAssets = component.assetOptions.slice(1); // Skip "None" option
      const names = dataAssets.map(a => a.name);
      const sortedNames = [...names].sort();
      expect(names).toEqual(sortedNames);
    });

    it('should set dialog title based on read-only mode', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.dialogTitle).toBe('Select Data Asset');
    });
  });

  describe('Asset Validation', () => {
    it('should default to "None" when currentDataAssetId is not provided', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetControl.value).toBe(component.NONE_VALUE);
    });

    it('should select current asset when valid data asset ID is provided', () => {
      const dialogDataWithAsset: DataAssetDialogData = {
        ...defaultDialogData,
        currentDataAssetId: 'asset-1',
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        dialogDataWithAsset,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetControl.value).toBe('asset-1');
    });

    it('should default to "None" when current asset does not exist', () => {
      const dialogDataWithInvalidAsset: DataAssetDialogData = {
        ...defaultDialogData,
        currentDataAssetId: 'non-existent-asset',
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        dialogDataWithInvalidAsset,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetControl.value).toBe(component.NONE_VALUE);
    });

    it('should default to "None" when current asset is not a data type', () => {
      const dialogDataWithNonDataAsset: DataAssetDialogData = {
        ...defaultDialogData,
        currentDataAssetId: 'asset-4', // hardware type
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        dialogDataWithNonDataAsset,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetControl.value).toBe(component.NONE_VALUE);
    });
  });

  describe('Read-Only Mode', () => {
    it('should disable form control when in read-only mode', () => {
      const readOnlyDialogData: DataAssetDialogData = {
        ...defaultDialogData,
        isReadOnly: true,
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        readOnlyDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetControl.disabled).toBe(true);
    });

    it('should show "View Data Asset" title in read-only mode', () => {
      const readOnlyDialogData: DataAssetDialogData = {
        ...defaultDialogData,
        isReadOnly: true,
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        readOnlyDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.dialogTitle).toBe('View Data Asset');
    });
  });

  describe('Dialog Actions', () => {
    it('should close dialog without result on cancel', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      component.onCancel();
      expect(mockDialogRef.close).toHaveBeenCalledWith();
    });

    it('should close dialog with null when "None" is selected', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      component.assetControl.setValue(component.NONE_VALUE);
      component.onSave();
      expect(mockDialogRef.close).toHaveBeenCalledWith(null);
    });

    it('should close dialog with asset ID when asset is selected', () => {
      const component = new DataAssetDialogComponent(
        mockDialogRef,
        defaultDialogData,
        mockTranslocoService,
      );
      component.ngOnInit();

      component.assetControl.setValue('asset-1');
      component.onSave();
      expect(mockDialogRef.close).toHaveBeenCalledWith('asset-1');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty asset list', () => {
      const emptyAssetData: DataAssetDialogData = {
        ...defaultDialogData,
        assets: [],
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        emptyAssetData,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetOptions.length).toBe(1); // Only "None" option
      expect(component.assetOptions[0].id).toBe(component.NONE_VALUE);
    });

    it('should handle asset list with no data type assets', () => {
      const nonDataAssets: DataAssetDialogData = {
        ...defaultDialogData,
        assets: [
          createMockAsset('asset-1', 'Server', 'hardware'),
          createMockAsset('asset-2', 'Software', 'software'),
        ],
      };

      const component = new DataAssetDialogComponent(
        mockDialogRef,
        nonDataAssets,
        mockTranslocoService,
      );
      component.ngOnInit();

      expect(component.assetOptions.length).toBe(1); // Only "None" option
      expect(component.assetOptions[0].id).toBe(component.NONE_VALUE);
    });
  });
});
