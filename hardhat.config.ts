import hardhatNodeTestRunner from "@nomicfoundation/hardhat-node-test-runner";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import { defineConfig } from "hardhat/config";

export default defineConfig({
  plugins: [hardhatNodeTestRunner, hardhatEthers],
  solidity: {
    version: "0.8.28",
  },
});
