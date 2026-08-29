import { spawn, ChildProcess } from 'node:child_process';
import path from 'node:path';
import electron from 'electron';

const electronPath = electron as unknown as string;
let electronProcess: ChildProcess | null = null;

function startElectron() {
  if (electronProcess) {
    electronProcess.kill();
    electronProcess = null;
  }

  const appPath = path.resolve('apps/desktop');

  electronProcess = spawn(electronPath, [appPath], {
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: 'development',
      DEV_SERVER_URL: 'http://localhost:5173',
    },
  });

  electronProcess.on('close', () => {
    process.exit(0);
  });
}

// Compile typescript and run electron
const tsc = spawn('npx', ['tsc', '--project', 'apps/desktop/tsconfig.json'], {
  stdio: 'inherit',
  shell: true,
});

tsc.on('close', (code) => {
  if (code === 0) {
    console.log('🚀 Iniciando aplicativo desktop GDisC Windows...');
    startElectron();
  } else {
    console.error('❌ Falha ao compilar TypeScript do Desktop');
  }
});
