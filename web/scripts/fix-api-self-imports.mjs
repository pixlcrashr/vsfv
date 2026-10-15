// Removes self-imports that ng-swagger-gen emits for recursive models
// (e.g. v1nested-account.ts importing V1NestedAccount from itself), which
// fail to compile. Run after generation: npm run generate:apiV2.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, parse } from 'node:path';
import { fileURLToPath } from 'node:url';

const modelsDir = fileURLToPath(new URL('../src/lib/api/models/', import.meta.url));

for (const file of readdirSync(modelsDir)) {
  if (!file.endsWith('.ts')) {
    continue;
  }
  const path = join(modelsDir, file);
  const content = readFileSync(path, 'utf8');
  const selfImportRe = new RegExp(
    `import \\{ ([A-Za-z0-9]+) \\} from '\\./${basename(file, '.ts')}';\\r?\\n`,
  );
  const match = content.match(selfImportRe);
  if (!match) {
    continue;
  }
  const imported = match[1];
  const declaresSymbol = new RegExp(`(interface|type|class|enum) ${imported}\\b`).test(content);
  if (declaresSymbol) {
    writeFileSync(path, content.replace(selfImportRe, ''));
    console.log(`Removed self-import of ${imported} from ${file}`);
  }
}
