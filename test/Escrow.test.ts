import { test } from "node:test";
import assert from "node:assert/strict";
import { network } from "hardhat";

test("Escrow: deploys correctly", async () => {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);

  await escrow.waitForDeployment();

  const storedSeller = await escrow.seller();
  const storedBuyer = await escrow.buyer();
  const storedState = await escrow.state();

  assert.equal(storedSeller, seller.address);
  assert.equal(storedBuyer, buyer.address);
  assert.equal(storedState, 0n); // AWAITING_PAYMENT
});

test("Escrow: buyer can deposit and state updates", async () => {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // Buyer deposits 1 ETH
  const depositTx = await escrow.connect(buyer).deposit({
    value: ethers.parseEther("1"),
  });
  await depositTx.wait();

  // Check contract balance
  const contractBalance = await ethers.provider.getBalance(
    await escrow.getAddress()
  );

  // Check state
  const state = await escrow.state();

  assert.equal(contractBalance, ethers.parseEther("1"));
  assert.equal(state, 1n); // AWAITING_DELIVERY
});

test("Escrow: buyer can refund and gets ETH back", async () => {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // Buyer deposits 1 ETH
  const depositTx = await escrow.connect(buyer).deposit({
    value: ethers.parseEther("1"),
  });
  await depositTx.wait();

  // Balance should now be 1 ETH in the contract
  const balanceAfterDeposit = await ethers.provider.getBalance(
    await escrow.getAddress()
  );
  assert.equal(balanceAfterDeposit, ethers.parseEther("1"));

  // Track buyer balance BEFORE refund
 const buyerBalanceBefore = BigInt(
  await ethers.provider.getBalance(buyer.address)
);

  // Refund
  const refundTx = await escrow.connect(buyer).refund();
  const refundReceipt = await refundTx.wait();

  // Gas cost 
// Gas cost (ethers v6 / hardhat 3 safe)
const gasUsed = refundReceipt!.gasUsed;
const gasPrice =
  refundReceipt!.gasPrice ?? refundReceipt!.effectiveGasPrice;

assert.ok(gasPrice !== undefined, "Gas price missing in receipt");

const gasCost = gasUsed * gasPrice;

  // Buyer balance after refund
  const buyerBalanceAfter = BigInt(
  await ethers.provider.getBalance(buyer.address)
);

  // Buyer should have received exactly 1 ETH back
  const received = buyerBalanceAfter + gasCost - buyerBalanceBefore;
  assert.equal(received, ethers.parseEther("1"));

  // Contract balance should be 0 after refund
  const finalContractBalance = await ethers.provider.getBalance(
    await escrow.getAddress()
  );
  assert.equal(finalContractBalance, 0n);

  const state = await escrow.state();
  assert.equal(state, 3n); // REFUNDED
});

test("Escrow: buyer can release and seller gets paid", async () => {
  const { ethers } = await network.connect();

  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // Buyer deposits 1 ETH
  const depositTx = await escrow.connect(buyer).deposit({
    value: ethers.parseEther("1"),
  });
  await depositTx.wait();

  // Contract balance should now be 1 ETH
  const balanceAfterDeposit = await ethers.provider.getBalance(
    await escrow.getAddress()
  );
  assert.equal(balanceAfterDeposit, ethers.parseEther("1"));

  // Track seller balance BEFORE release
  const sellerBalanceBefore = BigInt(
    await ethers.provider.getBalance(seller.address)
  );

  // Release (called by buyer)
  const releaseTx = await escrow.connect(buyer).release();
  const releaseReceipt = await releaseTx.wait();

  // Seller balance AFTER release
  const sellerBalanceAfter = BigInt(
    await ethers.provider.getBalance(seller.address)
  );

  // Seller should receive exactly 1 ETH (seller doesn't pay gas here)
  const receivedBySeller = sellerBalanceAfter - sellerBalanceBefore;
  assert.equal(receivedBySeller, ethers.parseEther("1"));

  // Contract balance should be 0 after release
  const finalContractBalance = await ethers.provider.getBalance(
    await escrow.getAddress()
  );
  assert.equal(finalContractBalance, 0n);

  // State should be COMPLETE (enum index 2)
  const state = await escrow.state();
  assert.equal(state, 2n); // COMPLETE

  // (Optional sanity) receipt exists
  assert.ok(releaseReceipt);
});

test("Escrow: non-buyer cannot deposit", async () => {
  const { ethers } = await network.connect();
  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // Seller tries to deposit (should fail because onlyBuyer)
  await assert.rejects(
    async () => {
      const tx = await escrow.connect(seller).deposit({
        value: ethers.parseEther("1"),
      });
      await tx.wait();
    },
    /Only buyer can call this/
  );
});

test("Escrow: buyer cannot deposit twice", async () => {
  const { ethers } = await network.connect();
  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // First deposit OK
  const depositTx = await escrow.connect(buyer).deposit({
    value: ethers.parseEther("1"),
  });
  await depositTx.wait();

  // Second deposit should fail (state is not AWAITING_PAYMENT anymore)
  await assert.rejects(
    async () => {
      const tx2 = await escrow.connect(buyer).deposit({
        value: ethers.parseEther("1"),
      });
      await tx2.wait();
    },
    /Payment already made/
  );
});

test("Escrow: buyer cannot refund before deposit", async () => {
  const { ethers } = await network.connect();
  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // No deposit yet -> refund should fail due to wrong state
  await assert.rejects(
    async () => {
      const tx = await escrow.connect(buyer).refund();
      await tx.wait();
    },
    /Not refundable now/
  );
});

test("Escrow: buyer cannot release before deposit", async () => {
  const { ethers } = await network.connect();
const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // No deposit yet -> release should fail
  await assert.rejects(
    async () => {
      const tx = await escrow.connect(buyer).release();
      await tx.wait();
    },
    /Not releasable now/
  );
});

test("Escrow: buyer cannot refund after release", async () => {
  const { ethers } = await network.connect();
  const [seller, buyer] = await ethers.getSigners();

  const Escrow = await ethers.getContractFactory("Escrow", seller);
  const escrow = await Escrow.deploy(buyer.address);
  await escrow.waitForDeployment();

  // Deposit
  const depositTx = await escrow.connect(buyer).deposit({
    value: ethers.parseEther("1"),
  });
  await depositTx.wait();

  // Release -> COMPLETE
  const releaseTx = await escrow.connect(buyer).release();
  await releaseTx.wait();

  // Refund should now fail
  await assert.rejects(
    async () => {
      const tx = await escrow.connect(buyer).refund();
      await tx.wait();
    },
    /Not refundable now/
  );
});
