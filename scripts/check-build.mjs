import { spawnSync } from 'node:child_process';

const commands = [
  ['npx', ['tsc', '--noEmit']],
  ['npm', ['run', 'build']],
];

for (const [command, args] of commands) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
