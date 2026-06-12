import { readFile } from "node:fs/promises";

const workflow = await readFile(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
const errors = [];

for (const required of [
  "contracts_version:",
  "CONTRACTS_VERSION:",
  "npm pkg set \"dependencies.@opensoha/contracts=${CONTRACTS_VERSION}\"",
  "npm install --no-audit --no-fund",
  "entry.version !== process.env.CONTRACTS_VERSION",
  "startsWith('file:')",
  "verify-release-artifact.mjs",
  "gh release download"
]) {
  if (!workflow.includes(required)) {
    errors.push(`release workflow is missing ${required}`);
  }
}

for (const forbidden of [
  "repository: opensoha/soha-contracts",
  "path: soha-contracts",
  "file:../soha-contracts"
]) {
  if (workflow.includes(forbidden)) {
    errors.push(`release workflow must not contain ${forbidden}`);
  }
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`release-workflow: ${error}`);
  }
  process.exit(1);
}

console.log("release workflow consumes versioned @opensoha/contracts package");
