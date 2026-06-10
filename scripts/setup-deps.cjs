// Ensures webgpu-ed25519 sibling is cloned and built in CI environments
// where only this repo is checked out (../webgpu-ed25519 does not exist).
// Locally, the directory already exists and is built, so this is a no-op.
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const gpuDir = path.resolve(__dirname, '..', '..', 'webgpu-ed25519');
const distDir = path.join(gpuDir, 'dist');

if (fs.existsSync(distDir)) process.exit(0);

if (!fs.existsSync(gpuDir)) {
  console.log('[setup-deps] Cloning webgpu-ed25519...');
  execSync('git clone --depth 1 https://github.com/trixky/webgpu-ed25519.git "' + gpuDir + '"', {
    stdio: 'inherit',
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
}

console.log('[setup-deps] Building webgpu-ed25519...');
execSync('npm install --ignore-scripts', { cwd: gpuDir, stdio: 'inherit' });
execSync('npm run build', { cwd: gpuDir, stdio: 'inherit' });
console.log('[setup-deps] Done.');
