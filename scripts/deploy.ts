import { network } from "hardhat";

async function main() {
  const { ethers } = await network.connect();

  const [deployer] = await ethers.getSigners();
  console.log("🚀 Deploying contracts with the account:", deployer.address);

  const Factory = await ethers.getContractFactory("EscrowFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  console.log("✅ EscrowFactory deployed to:", factoryAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});