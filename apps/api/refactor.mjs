import fs from 'fs/promises';
import path from 'path';

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

async function processFile(filePath) {
  let content = await fs.readFile(filePath, 'utf-8');
  let originalContent = content;

  // Fix Fastify request/reply
  content = content.replace(/\(request:\s*any,\s*reply:\s*any\)/g, '(request: FastifyRequest, reply: FastifyReply)');
  content = content.replace(/\(request:\s*any,\s*reply\)/g, '(request: FastifyRequest, reply: FastifyReply)');
  
  // Update Fastify imports if FastifyRequest/FastifyReply are used
  if (content.includes('FastifyRequest') && !content.includes('import { FastifyRequest')) {
    content = content.replace(/import\s*\{\s*FastifyInstance\s*\}\s*from\s*'fastify';/, "import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';");
  }

  // Fix catch (err: any)
  content = content.replace(/catch\s*\(\s*([a-zA-Z0-9_]+)\s*:\s*any\s*\)/g, 'catch ($1)');

  // Common : any replacements
  content = content.replace(/oldCliente:\s*any,\s*data:\s*any/g, 'oldCliente: Record<string, unknown>, data: Record<string, unknown>');
  content = content.replace(/oldProjeto:\s*any,\s*data:\s*any/g, 'oldProjeto: Record<string, unknown>, data: Record<string, unknown>');
  content = content.replace(/file:\s*any/g, 'file: unknown');
  content = content.replace(/dbOrTx:\s*any/g, 'dbOrTx: unknown');
  content = content.replace(/request:\s*any/g, 'request: unknown');
  content = content.replace(/reply:\s*any/g, 'reply: unknown');
  content = content.replace(/oldData\?:?\s*any/g, 'oldData?: unknown');
  content = content.replace(/newData\?:?\s*any/g, 'newData?: unknown');
  content = content.replace(/geometryCoords:\s*any/g, 'geometryCoords: unknown');
  
  // Replace array types
  content = content.replace(/:\s*any\[\]/g, ': unknown[]');

  // Generic : any to : unknown where it's explicitly typed
  content = content.replace(/:\s*any(?![,)\]])/g, ': unknown');

  if (content !== originalContent) {
    await fs.writeFile(filePath, content, 'utf-8');
    console.log(`Updated ${filePath}`);
  }
}

processDirectory('./src').catch(console.error);
