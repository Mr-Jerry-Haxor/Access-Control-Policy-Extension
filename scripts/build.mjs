import { cp, mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const directories = ["ai", "api", "checkpoints", "core", "knowledge", "popup", "storage", "utils"];
const files = ["manifest.json", "service_worker.js"];

if (!dist.startsWith(root + path.sep)) throw new Error("Refusing to build outside the repository.");
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

for (const directory of directories) {
    await cp(path.join(root, directory), path.join(dist, directory), { recursive: true });
}
for (const file of files) {
    await cp(path.join(root, file), path.join(dist, file));
}

const manifest = JSON.parse(await readFile(path.join(dist, "manifest.json"), "utf8"));
if (manifest.manifest_version !== 3) throw new Error("Built manifest is not Manifest V3.");
if (manifest.background?.service_worker !== "service_worker.js") throw new Error("Built manifest has an unexpected service worker.");

console.log(`Built ACP Validator ${manifest.version} at ${dist}`);
