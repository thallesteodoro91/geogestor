import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const desktopDir = path.dirname(fileURLToPath(import.meta.url));
const stagingDir = path.join(desktopDir, '.build-app');

const resolvedDesktopDir = fs.realpathSync(desktopDir);
const resolvedStagingParent = path.dirname(stagingDir);
if (fs.realpathSync(resolvedStagingParent) !== resolvedDesktopDir) {
  throw new Error(`Unexpected staging parent: ${stagingDir}`);
}

fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(path.join(stagingDir, 'build'), { recursive: true });

for (const fileName of ['main.js', 'preload.js', 'restore-authorization.cjs']) {
  fs.copyFileSync(path.join(desktopDir, fileName), path.join(stagingDir, fileName));
}

for (const iconName of ['icon.ico', 'icon.png']) {
  fs.copyFileSync(path.join(desktopDir, 'build', iconName), path.join(stagingDir, 'build', iconName));
}

fs.writeFileSync(
  path.join(stagingDir, 'before-build.cjs'),
  "exports.default = async function beforeBuild() { return false; };\n"
);

const sourcePackageJson = JSON.parse(
  fs.readFileSync(path.join(desktopDir, 'package.json'), 'utf8')
);
const commercialVersion = sourcePackageJson.version.replace(/\.0$/, '');

const packageJson = {
  name: 'geogestor-desktop',
  version: sourcePackageJson.version,
  description: 'GeoGestor - Gestao para Topografia (Desktop)',
  main: 'main.js',
  author: 'GeoGestor',
  packageManager: 'npm@11.13.0',
  private: true,
  dependencies: {},
  build: {
    appId: 'com.geogestor.desktop',
    productName: 'GeoGestor',
    artifactName: `\${productName} Setup ${commercialVersion}.\${ext}`,
    electronVersion: '35.7.5',
    npmRebuild: false,
    beforeBuild: './before-build.cjs',
    directories: {
      buildResources: 'build',
      output: '../dist'
    },
    files: [
      'main.js',
      'preload.js',
      'restore-authorization.cjs',
      'package.json'
    ],
    extraResources: [
      {
        from: '../../api/dist',
        to: 'api',
        filter: ['**/*']
      },
      {
        from: '../../web/dist',
        to: 'web',
        filter: ['**/*']
      }
    ],
    win: {
      icon: 'build/icon.ico',
      target: [
        {
          target: 'nsis',
          arch: ['x64']
        }
      ]
    },
    nsis: {
      oneClick: false,
      perMachine: false,
      allowToChangeInstallationDirectory: true,
      shortcutName: 'GeoGestor'
    }
  }
};

fs.writeFileSync(path.join(stagingDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`);
