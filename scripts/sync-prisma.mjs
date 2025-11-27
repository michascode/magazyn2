import { spawnSync } from 'node:child_process';

const NPX_COMMAND = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
}

function runCapture(command, args) {
  return spawnSync(command, args, {
    stdio: 'pipe',
    env: process.env,
    encoding: 'utf-8',
  });
}

function shouldFallback({ stdout = '', stderr = '' } = {}) {
  const combinedOutput = `${stderr}\n${stdout}`;
  if (!combinedOutput.trim()) return false;

  return /P3005/.test(combinedOutput) || /database schema is not empty/i.test(combinedOutput);
}

function main() {
  const deployResult = runCapture(NPX_COMMAND, ['prisma', 'migrate', 'deploy']);

  if (deployResult.error) {
    throw deployResult.error;
  }

  if (deployResult.status === 0) {
    process.stdout.write(deployResult.stdout);
    const generateResult = run(NPX_COMMAND, ['prisma', 'generate']);
    if (generateResult.status !== 0) {
      process.exit(generateResult.status ?? 1);
    }
    return;
  }

  const hasFallbackSignal = shouldFallback(deployResult);

  if (deployResult.stderr) {
    process.stderr.write(deployResult.stderr);
  }
  if (deployResult.stdout && !hasFallbackSignal) {
    process.stdout.write(deployResult.stdout);
  }

  if (!hasFallbackSignal) {
    process.exit(deployResult.status ?? 1);
  }

  console.warn('\n⚠️  prisma migrate deploy could not run because the database is already populated. Falling back to prisma db push...\n');
  const pushResult = run(NPX_COMMAND, ['prisma', 'db', 'push']);

  if (pushResult.status !== 0) {
    process.exit(pushResult.status ?? 1);
  }

  const generateResult = run(NPX_COMMAND, ['prisma', 'generate']);
  if (generateResult.status !== 0) {
    process.exit(generateResult.status ?? 1);
  }
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}