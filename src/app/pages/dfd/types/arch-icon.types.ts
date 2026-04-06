/**
 * Architecture Icon Types
 *
 * Data model for architecture icons displayed on DFD shapes.
 * Icons are stored in cell.data._arch and resolved to SVG asset paths.
 */

export type ArchIconProvider = 'aws' | 'azure' | 'gcp' | 'oci';
export type ArchIconType = 'services' | 'resources' | 'groups' | 'categories';

export interface ArchIconPlacement {
  vertical: 'top' | 'middle' | 'bottom';
  horizontal: 'left' | 'center' | 'right';
}

/** Stored on cell.data._arch */
export interface ArchIconData {
  provider: ArchIconProvider;
  type: ArchIconType;
  subcategory: string;
  icon: string;
  placement: ArchIconPlacement;
}

/** Single entry in the icon manifest */
export interface ArchIconManifestEntry {
  provider: string;
  type: string;
  subcategory: string;
  icon: string;
  label: string;
  tokens: string[];
  path: string; // relative path from icons root, e.g. "aws/services/compute/amazon-ec2.svg"
}

/** Icon manifest root object */
export interface ArchIconManifest {
  icons: ArchIconManifestEntry[];
}

/** Search result grouped by subcategory */
export interface ArchIconSearchResult {
  subcategory: string;
  provider: string;
  icons: ArchIconManifestEntry[];
}

/** Default placement for newly assigned icons */
export const DEFAULT_ARCH_ICON_PLACEMENT: ArchIconPlacement = {
  vertical: 'middle',
  horizontal: 'center',
};

/** Shape types that support architecture icons */
export const ICON_ELIGIBLE_SHAPES = ['actor', 'process', 'store', 'security-boundary'] as const;

/** Shape types where border/fill hiding applies (excludes security-boundary) */
export const ICON_HIDEABLE_BORDER_SHAPES = ['actor', 'process', 'store'] as const;
