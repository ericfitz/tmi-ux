import type { ContentProviderId, ContentProviderMetadata } from '../models/content-provider.types';
import { GoogleDrivePickerService } from './google-drive-picker.service';
import { MicrosoftFilePickerService } from './microsoft-file-picker.service';

/**
 * Typed lookup of all content providers known to tmi-ux. Consumers iterate
 * this map to render source selectors and resolve picker services. Adding a
 * new provider = one new entry here + one new picker-service file.
 */
/**
 * CSP directives shared by both delegated (google_workspace) and service-mode
 * (google_drive) Google providers — they both render the same Google Picker
 * iframe and load the same Google Identity Services / gapi scripts.
 */
const GOOGLE_CSP_DIRECTIVES = {
  frameSrc: ['https://docs.google.com', 'https://accounts.google.com'],
  scriptSrc: ['https://apis.google.com', 'https://accounts.google.com/gsi/client'],
};

export const CONTENT_PROVIDERS: Record<ContentProviderId, ContentProviderMetadata> = {
  google_workspace: {
    id: 'google_workspace',
    displayNameKey: 'documentSources.googleDrive.name',
    icon: '/static/provider-logos/google-drive.svg',
    supportsPicker: true,
    pickerService: GoogleDrivePickerService,
    cspDirectives: GOOGLE_CSP_DIRECTIVES,
  },
  google_drive: {
    id: 'google_drive',
    displayNameKey: 'documentSources.googleDrive.name',
    icon: '/static/provider-logos/google-drive.svg',
    supportsPicker: true,
    pickerService: GoogleDrivePickerService,
    cspDirectives: GOOGLE_CSP_DIRECTIVES,
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
