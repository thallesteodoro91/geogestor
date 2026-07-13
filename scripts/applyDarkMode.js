const fs = require('fs');
const path = require('path');

const applyDarkMode = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace utility classes ensuring we don't duplicate `dark:xxx`
  // We use a regex that matches `class-name` but only if it's NOT followed by ` dark:class-name`
  
  const replacements = [
    { pattern: /\bbg-white(?!\s+dark:bg-zinc-[0-9]+)\b/g, replacement: 'bg-white dark:bg-zinc-900' },
    { pattern: /\bbg-zinc-50(?!\/|\s+dark:bg-zinc-[0-9]+)\b/g, replacement: 'bg-zinc-50 dark:bg-zinc-950' },
    { pattern: /\bbg-zinc-50\/50(?!\s+dark:bg-zinc-[0-9]+\/[0-9]+)\b/g, replacement: 'bg-zinc-50/50 dark:bg-zinc-900/50' },
    { pattern: /\btext-zinc-900(?!\s+dark:text-[a-z]+)\b/g, replacement: 'text-zinc-900 dark:text-zinc-100' },
    { pattern: /\btext-zinc-950(?!\s+dark:text-[a-z]+)\b/g, replacement: 'text-zinc-950 dark:text-white' },
    { pattern: /\btext-zinc-800(?!\s+dark:text-[a-z]+)\b/g, replacement: 'text-zinc-800 dark:text-zinc-200' },
    { pattern: /\bborder-zinc-200(?!\/|\s+dark:border-[a-z]+)\b/g, replacement: 'border-zinc-200 dark:border-zinc-800' },
    { pattern: /\bborder-zinc-100(?!\s+dark:border-[a-z]+)\b/g, replacement: 'border-zinc-100 dark:border-zinc-800' },
    { pattern: /\btext-zinc-500(?!\s+dark:text-[a-z]+)\b/g, replacement: 'text-zinc-500 dark:text-zinc-400' },
    { pattern: /className="fixed inset-0 z-\[100\] flex items-center justify-center p-4"/g, replacement: 'className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 overflow-y-auto overflow-x-hidden"' },
    { pattern: /max-h-\[90vh\] flex flex-col overflow-y-auto/g, replacement: 'my-auto flex flex-col' },
    { pattern: /max-h-\[90vh\] flex flex-col overflow-hidden/g, replacement: 'my-auto flex flex-col' }
  ];

  let newContent = content;
  replacements.forEach(({ pattern, replacement }) => {
    newContent = newContent.replace(pattern, replacement);
  });

  if (newContent !== content) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Updated: ${filePath}`);
  }
};

const pagesDir = path.join(__dirname, '../apps/web/src/pages');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    if (fs.statSync(dirFile).isDirectory()) {
      filelist = walkSync(dirFile, filelist);
    } else {
      if (dirFile.endsWith('.tsx')) {
        filelist.push(dirFile);
      }
    }
  });
  return filelist;
};

const files = walkSync(pagesDir);
files.forEach(applyDarkMode);
console.log('Done!');
