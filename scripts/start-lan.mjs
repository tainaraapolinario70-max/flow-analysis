import { networkInterfaces } from "node:os";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const viteEntry = resolve(projectDirectory, "node_modules", "vite", "bin", "vite.js");
const requestedPort = Number.parseInt(process.env.VIGI_FLUXO_PORT ?? "4173", 10);
const port = Number.isInteger(requestedPort) && requestedPort > 0 ? requestedPort : 4173;
const host = process.env.VIGI_FLUXO_HOST ?? "0.0.0.0";

function lanAddresses() {
  const addresses = [];

  try {
    for (const interfaces of Object.values(networkInterfaces())) {
      for (const address of interfaces ?? []) {
        if (address.family === "IPv4" && !address.internal) {
          addresses.push(`http://${address.address}:${port}`);
        }
      }
    }
  } catch {
    // Some restricted runtimes cannot enumerate adapters. The server can still
    // start normally and the address can be obtained with ipconfig/ifconfig.
  }

  return [...new Set(addresses)];
}

console.log("\nANÁLISE DE FLUXO — SERVIDOR NA REDE LOCAL");
console.log("====================================");
console.log("Abra em outros computadores usando um destes endereços:");
const addresses = lanAddresses();
for (const address of addresses) console.log(`  ${address}`);
if (addresses.length === 0) {
  console.log(`  http://IP-DO-SERVIDOR:${port}  (consulte o IP com ipconfig)`);
}
console.log(`  http://localhost:${port}  (somente neste computador)`);
console.log("\nMantenha esta janela aberta. Para encerrar, pressione Ctrl+C.\n");

const child = spawn(
  process.execPath,
  [viteEntry, "--host", host, "--port", String(port), "--strictPort"],
  {
    cwd: projectDirectory,
    env: {
      ...process.env,
      WRANGLER_LOG_PATH: resolve(projectDirectory, ".wrangler", "wrangler.log"),
      WRANGLER_WRITE_LOGS: "false",
      MINIFLARE_REGISTRY_PATH: resolve(projectDirectory, ".wrangler", "registry"),
      CLOUDFLARE_CF_FETCH_ENABLED: "false",
    },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error(`Não foi possível iniciar o servidor: ${error.message}`);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
