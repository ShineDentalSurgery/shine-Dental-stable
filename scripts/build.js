const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((dirent) => {
    const fullPath = path.join(dir, dirent.name);
    if (dirent.isDirectory()) {
      if (dirent.name === 'node_modules' || dirent.name === '.git') return [];
      return walk(fullPath);
    }
    if (dirent.isFile() && fullPath.endsWith('.js')) {
      return [fullPath];
    }
    return [];
  });
}

const jsFiles = walk(process.cwd());
let failed = false;

console.log('Checking JavaScript syntax for', jsFiles.length, 'files...');
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'inherit' });
  if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error('\nBuild failed: JavaScript syntax errors detected.');
  process.exit(1);
}

console.log('\nBuild completed successfully. No JavaScript syntax errors found.');
