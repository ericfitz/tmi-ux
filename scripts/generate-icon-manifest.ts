import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ICONS_DIR = path.resolve(__dirname, '../src/assets/architecture-icons');
const OUTPUT_FILE = path.join(ICONS_DIR, 'manifest.json');

// Known acronyms to uppercase in labels
const ACRONYMS = new Set([
  'ec2', 'ecs', 'eks', 'sql', 'db', 'vpn', 'api', 'cdn', 'iam', 'rds',
  'sqs', 'sns', 'emr', 's3', 'efs', 'ebs', 'elb', 'alb', 'nlb', 'acm',
  'kms', 'waf', 'vpc', 'nat', 'dns', 'ssl', 'tls', 'ssh', 'http', 'https',
  'tcp', 'udp', 'ip', 'iot', 'ai', 'ml', 'ci', 'cd', 'vm', 'gpu', 'cpu',
  'ram', 'ssd', 'hdd', 'os', 'sdk', 'cli', 'ui', 'ux', 'id', 'arn',
  'oci', 'gcp', 'aws', 'dms', 'fsx', 'msk', 'mq', 'ses', 'lex', 'glue',
  'sso', 'ad', 'ldap', 'saml', 'oidc', 'oauth', 'adb', 'ocid',
]);

interface ManifestEntry {
  provider: string;
  type: string;
  subcategory: string;
  icon: string;
  path: string;
  label: string;
  tokens: string[];
}

function humanizeFilename(filename: string): string {
  return filename
    .split('-')
    .map(word => {
      if (ACRONYMS.has(word.toLowerCase())) {
        return word.toUpperCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

function generateTokens(entry: Omit<ManifestEntry, 'tokens'>): string[] {
  const parts = [
    entry.provider,
    entry.type,
    entry.subcategory,
    ...entry.icon.split('-'),
  ];
  const tokens = new Set(parts.map(p => p.toLowerCase()).filter(p => p.length > 0));
  return Array.from(tokens);
}

function findSvgsRecursively(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    if (fs.statSync(fullPath).isDirectory()) {
      results.push(...findSvgsRecursively(fullPath));
    } else if (entry.endsWith('.svg')) {
      results.push(fullPath);
    }
  }
  return results;
}

function walkIcons(): ManifestEntry[] {
  const entries: ManifestEntry[] = [];
  const providers = fs.readdirSync(ICONS_DIR).filter(f => {
    const fullPath = path.join(ICONS_DIR, f);
    return fs.statSync(fullPath).isDirectory();
  });

  for (const provider of providers) {
    const providerDir = path.join(ICONS_DIR, provider);
    const types = fs.readdirSync(providerDir).filter(f =>
      fs.statSync(path.join(providerDir, f)).isDirectory()
    );

    for (const type of types) {
      const typeDir = path.join(providerDir, type);
      const subcategories = fs.readdirSync(typeDir).filter(f =>
        fs.statSync(path.join(typeDir, f)).isDirectory()
      );

      if (subcategories.length > 0) {
        for (const subcategory of subcategories) {
          const subcatDir = path.join(typeDir, subcategory);
          const svgs = findSvgsRecursively(subcatDir);

          for (const svgPath of svgs) {
            const svg = path.basename(svgPath);
            const icon = svg.replace('.svg', '');
            const relativePath = path.relative(ICONS_DIR, svgPath).split(path.sep).join('/');
            const partial = {
              provider,
              type,
              subcategory,
              icon,
              path: relativePath,
              label: humanizeFilename(icon),
            };
            entries.push({ ...partial, tokens: generateTokens(partial) });
          }
        }
      } else {
        const svgs = findSvgsRecursively(typeDir);

        for (const svgPath of svgs) {
          const svg = path.basename(svgPath);
          const icon = svg.replace('.svg', '');
          const relativePath = path.relative(ICONS_DIR, svgPath).split(path.sep).join('/');
          const partial = {
            provider,
            type,
            subcategory: type,
            icon,
            path: relativePath,
            label: humanizeFilename(icon),
          };
          entries.push({ ...partial, tokens: generateTokens(partial) });
        }
      }
    }
  }

  return entries.sort((a, b) =>
    `${a.provider}/${a.type}/${a.subcategory}/${a.icon}`.localeCompare(
      `${b.provider}/${b.type}/${b.subcategory}/${b.icon}`
    )
  );
}

const icons = walkIcons();
const manifest = { icons };
fs.writeFileSync(OUTPUT_FILE, JSON.stringify(manifest, null, 2) + '\n');
console.log(`Generated manifest with ${icons.length} icons at ${OUTPUT_FILE}`);
