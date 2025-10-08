const fs = require('fs').promises;
const path = require('path');

async function copyDocs() {
    const src = path.join(process.env.TMI_DIRECTORY, 'docs');
    const dest = path.join(process.env.TMI_UX_DIRECTORY, 'docs-server');
    await fs.cp(src, dest, { recursive: true });
}

copyDocs().catch(console.error);
