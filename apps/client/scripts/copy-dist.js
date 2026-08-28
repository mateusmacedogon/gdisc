import fs from 'node:fs';
import path from 'node:path';

try {
  const source = path.resolve('dist');
  const target = path.resolve('../../dist');
  if (fs.existsSync(source)) {
    fs.cpSync(source, target, { recursive: true, force: true });
    console.log('✅ Dist sincronizado para raiz e apps/client/dist');
  }
} catch (err) {
  console.warn('Sync dist warning:', err);
}
