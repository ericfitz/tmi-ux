import { promises as fs } from 'fs';
import { join } from 'path';

async function copyDocs() {
    const src = join(process.env.TMI_DIRECTORY, 'docs');
    const dest = join(process.env.TMI_UX_DIRECTORY, 'docs-server');
    await fs.rm(dest, { recursive: true });
    await fs.mkdir(dest);
    await fs.cp(src, dest, { recursive: true });
}

copyDocs().catch(console.error);
