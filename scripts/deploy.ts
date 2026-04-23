import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { network } from "hardhat";

function deploymentSlug(chainId: bigint): string {
  const n = Number(chainId);
  if (n === 11155111) return "sepolia";
  if (n === 31337) return "hardhat";
  if (n === 1) return "mainnet";
  return `chain-${n}`;
}

async function main() {
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with the account:", deployer.address);

  const Factory = await ethers.getContractFactory("EscrowFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ EscrowFactory deployed to:", factoryAddress);

  const net = await ethers.provider.getNetwork();
  const slug = deploymentSlug(net.chainId);
  const manifest = {
    network: slug,
    chainId: Number(net.chainId),
    factoryAddress,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const dir = join(process.cwd(), "deployments");
  mkdirSync(dir, { recursive: true });
  const outPath = join(dir, `${slug}.json`);
  writeFileSync(outPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  console.log("📝 Wrote deployment manifest:", outPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});