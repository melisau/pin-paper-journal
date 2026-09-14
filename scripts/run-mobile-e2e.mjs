import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import process from "node:process";

const host = "127.0.0.1";
const port = "3100";
const previewUrl = `http://${host}:${port}/preview`;
const nextCli = fileURLToPath(new URL("../node_modules/next/dist/bin/next", import.meta.url));
const playwrightCli = fileURLToPath(new URL("../node_modules/@playwright/test/cli.js", import.meta.url));

const server = spawn(process.execPath, [nextCli, "start", "--hostname", host, "--port", port], {
  env: { ...process.env, ENABLE_E2E_PREVIEW: "1" },
  stdio: ["ignore", "pipe", "pipe"],
});

server.stdout.pipe(process.stdout);
server.stderr.pipe(process.stderr);

async function waitForPreview() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Preview server exited with code ${server.exitCode}.`);
    try {
      const response = await fetch(previewUrl);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error("Timed out waiting for the mobile E2E preview server.");
}

async function stopServer() {
  if (server.exitCode !== null) return;
  server.kill();
  await Promise.race([once(server, "exit"), new Promise(resolve => setTimeout(resolve, 5_000))]);
  if (server.exitCode === null) server.kill("SIGKILL");
}

let exitCode = 1;
try {
  await waitForPreview();
  const runner = spawn(process.execPath, [playwrightCli, "test", ...process.argv.slice(2)], {
    env: process.env,
    stdio: "inherit",
  });
  const [code] = await once(runner, "exit");
  exitCode = code ?? 1;
} catch (error) {
  console.error(error);
} finally {
  await stopServer();
}

process.exitCode = exitCode;
