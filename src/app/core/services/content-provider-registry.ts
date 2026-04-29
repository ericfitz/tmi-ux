import type { ContentProviderId, ContentProviderMetadata } from '../models/content-provider.types';
import { GoogleDrivePickerService } from './google-drive-picker.service';
import { MicrosoftFilePickerService } from './microsoft-file-picker.service';

/**
 * Typed lookup of all content providers known to tmi-ux. Consumers iterate
 * this map to render source selectors and resolve picker services. Adding a
 * new provider = one new entry here + one new picker-service file.
 */
export const CONTENT_PROVIDERS: Record<ContentProviderId, ContentProviderMetadata> = {
  google_workspace: {
    id: 'google_workspace',
    displayNameKey: 'documentSources.googleDrive.name',
    icon: '/static/provider-logos/google-drive.svg',
    supportsPicker: true,
    pickerService: GoogleDrivePickerService,
  },
  microsoft: {
    id: 'microsoft',
    displayNameKey: 'documentSources.microsoft.name',
    icon: '/static/provider-logos/onedrive.svg',
    supportsPicker: true,
    pickerService: MicrosoftFilePickerService,
    cspDirectives: {
      frameSrc: ['https://*.sharepoint.com', 'https://login.microsoftonline.com'],
      formAction: ['https://*.sharepoint.com'],
    },
  },
};
