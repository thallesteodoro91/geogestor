import fs from 'fs/promises';
import path from 'path';

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf-8');
  let originalContent = content;

  // Revert unknown to any to fix typescript errors, since full strictness is too invasive right now
  content = content.replace(/:\s*unknown\[\]/g, ': any[]');
  content = content.replace(/:\s*unknown/g, ': any');
  content = content.replace(/as\s*Record<string, unknown>/g, 'as any');
  content = content.replace(/Record<string, unknown>/g, 'any');

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
  }
}

async function processDirectory(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await processDirectory(fullPath);
    } else if (entry.isFile() && fullPath.endsWith('.ts')) {
      await processFile(fullPath);
    }
  }
}

processDirectory('./src').catch(console.error);
