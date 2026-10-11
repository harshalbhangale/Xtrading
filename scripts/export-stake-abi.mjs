import { mkdir, readFile, writeFile } from "node:fs/promises";

const artifact = JSON.parse(
  await readFile(
    new URL(
      "../contracts/out/CreatorStake.sol/CreatorStake.json",
      import.meta.url,
    ),
    "utf8",
  ),
);
const directory = new URL("../packages/integrations/abi/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(
  new URL("CreatorStake.json", directory),
  `${JSON.stringify(artifact.abi, null, 2)}\n`,
);
console.log("Exported CreatorStake ABI from the Foundry build.");

await writeFile(
  new URL("CreatorStake-deployment.json", directory),
  `${JSON.stringify({ bytecode: artifact.bytecode.object }, null, 2)}\n`,
);
