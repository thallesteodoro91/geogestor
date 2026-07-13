import fs from 'fs/promises';
import path from 'path';

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf-8');
  let originalContent = content;

  // Replace `as any` with `as Record<string, unknown>`
  content = content.replace(/as\s*any/g, 'as Record<string, unknown>');

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
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
