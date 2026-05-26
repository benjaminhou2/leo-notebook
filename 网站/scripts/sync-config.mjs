import { copyFile, mkdir, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const siteRoot = path.resolve(scriptDir, '..');
const projectRoot = path.resolve(siteRoot, '..');
const sourceConfigDir = path.join(projectRoot, 'config');
const publicConfigDir = path.join(siteRoot, 'public', 'config');
const publicMaterialsDir = path.join(siteRoot, 'public', 'materials');

const configFiles = ['site.json', 'auth.json', 'content-index.json'];

async function copyConfig() {
  await mkdir(publicConfigDir, { recursive: true });
  for (const filename of configFiles) {
    await copyFile(path.join(sourceConfigDir, filename), path.join(publicConfigDir, filename));
  }
}

function collectMaterialSources(index) {
  const sources = new Set();

  for (const material of index.materialGroups ?? []) {
    for (const rawFile of material.rawFiles ?? []) {
      if (rawFile.source) sources.add(rawFile.source);
    }
    if (material.analysis?.file) sources.add(material.analysis.file);
    for (const learningLink of material.learningLinks ?? []) {
      if (learningLink.source) sources.add(learningLink.source);
    }
  }

  for (const plan of index.knowledgePlans ?? []) {
    for (const practiceFile of plan.practiceFiles ?? []) {
      if (practiceFile.source) sources.add(practiceFile.source);
    }
  }

  for (const item of index.items ?? []) {
    for (const sourceFile of item.sourceFiles ?? []) {
      if (sourceFile.source) sources.add(sourceFile.source);
    }
    for (const key of ['diagnosisFile', 'leoPageMarkdown', 'leoPageHtml']) {
      if (item[key]) sources.add(item[key]);
    }
  }

  return [...sources];
}

async function copyMaterials() {
  const indexPath = path.join(sourceConfigDir, 'content-index.json');
  const index = JSON.parse(await readFile(indexPath, 'utf8'));
  const sources = collectMaterialSources(index);

  await rm(publicMaterialsDir, { recursive: true, force: true });

  for (const source of sources) {
    const from = path.join(projectRoot, source);
    if (!existsSync(from)) {
      console.warn(`skip missing material: ${source}`);
      continue;
    }

    const to = path.join(publicMaterialsDir, source);
    await mkdir(path.dirname(to), { recursive: true });
    await copyFile(from, to);
  }
}

await copyConfig();
await copyMaterials();
console.log('synced config and learning materials');
