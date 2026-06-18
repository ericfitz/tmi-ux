import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

export interface GoogleDriveLocalConfig {
  googleAccount: string;
  fixtureFileId: string;
  fixtureFileName: string;
  fixtureMimeType: string;
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_PATH = join(__dirname, '..', 'config', 'google-drive.local.json');

export const GOOGLE_DRIVE_SKIP_REASON =
  'google-drive.local.json not found — copy e2e/config/google-drive.local.json.example, fill in fixture values, and re-run.';

// SEM@b3ead44cf22347220a308a3b5d954272ebc12eb5: fetch and validate Google Drive local config from disk (reads file)
export function loadGoogleDriveConfig(): GoogleDriveLocalConfig | null {
  if (!existsSync(CONFIG_PATH)) return null;
  const raw = readFileSync(CONFIG_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<GoogleDriveLocalConfig>;
  if (
    !parsed.googleAccount ||
    !parsed.fixtureFileId ||
    !parsed.fixtureFileName ||
    !parsed.fixtureMimeType
  ) {
    throw new Error(
      `${CONFIG_PATH} is missing required fields. See google-drive.local.json.example.`,
    );
  }
  return parsed as GoogleDriveLocalConfig;
}
