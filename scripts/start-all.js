import { spawn } from 'node:child_process';

console.log('Memulai Brilliant Budget: Backend SQLite + Frontend Vite...');

// 1. Jalankan Backend Server
const serverProc = spawn('node', ['server/index.ts'], {
  stdio: 'inherit',
  shell: true,
});

// 2. Jalankan Frontend Vite
const viteProc = spawn('npm', ['run', 'dev'], {
  stdio: 'inherit',
  shell: true,
});

const cleanup = () => {
  console.log('\nMematikan semua layanan Catat...');
  serverProc.kill();
  viteProc.kill();
  process.exit(0);
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
