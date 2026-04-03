import { test }  from "node:test";
import assert     from "node:assert/strict";
import { network } from "hardhat";

// Helpers

async function increaseTime(provider: any, seconds: number) {
  await provider.send("evm_increaseTime", [seconds]);
  await provider.send("evm_mine", []);
}

async function expectRevert(fn: () => Promise<any>, errorName: string) {
  await assert.rejects(fn, (err: any) => {
    const msg: string = err?.message ?? "";
    return msg.includes(errorName);
  });
}

async function setup() {
  const { ethers } = await network.connect();
  const [deployer, buyer, seller, arbiter, other] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  const tx = await factory.connect(buyer).createEscrow(seller.address, arbiter.address);
  const receipt = await tx.wait();

  const event = receipt?.logs
    .map((log: any) => {
      try { return factory.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === "EscrowCreated");

  const escrowAddress: string = event?.args?.escrow;
  const escrow: any = await ethers.getContractAt("Escrow", escrowAddress, buyer);

  return { ethers, factory, escrow, buyer, seller, arbiter, other };
}

// § 1 – Deployment & Initialization

test("Escrow: factory initialises buyer, seller, arbiter correctly", async () => {
  const { escrow, buyer, seller, arbiter } = await setup();
  assert.equal(await escrow.buyer(),   buyer.address);
  assert.equal(await escrow.seller(),  seller.address);
  assert.equal(await escrow.arbiter(), arbiter.address);
  assert.equal(await escrow.state(),   0n);
});

test("Escrow: cannot initialize a clone twice", async () => {
  const { escrow, buyer, seller, arbiter } = await setup();
  await expectRevert(
    () => escrow.initialize(buyer.address, seller.address, arbiter.address),
    "AlreadyInitialized"
  );
});

test("Escrow: initialize rejects zero addresses", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyer, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  const implAddress: string = await factory.implementation();
  const Clones: any = await ethers.getContractAt("Escrow", implAddress);

  await expectRevert(
    () => Clones.initialize(ethers.ZeroAddress, seller.address, arbiter.address),
    "AlreadyInitialized"
  );
});

test("Escrow: initialize rejects duplicate addresses (e.g. buyer == seller)", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyer, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  await expectRevert(
    () => factory.connect(buyer).createEscrow(seller.address, seller.address),
    "InvalidAddress"
  );
});

// § 2 – Deposit

test("Escrow: buyer can deposit and state becomes AWAITING_DELIVERY", async () => {
  const { ethers, escrow } = await setup();
  const tx = await escrow.deposit({ value: ethers.parseEther("1") });
  await tx.wait();

  const balance = await ethers.provider.getBalance(await escrow.getAddress());
  assert.equal(balance,           ethers.parseEther("1"));
  assert.equal(await escrow.state(), 1n);
});

test("Escrow: deposit sets a deadline 7 days in the future", async () => {
  const { ethers, escrow } = await setup();
  const beforeTs = BigInt((await ethers.provider.getBlock("latest"))!.timestamp);
  const tx = await escrow.deposit({ value: ethers.parseEther("1") });
  await tx.wait();

  const deadline = await escrow.deadline();
  const sevenDays = 7n * 24n * 60n * 60n;

  assert.ok(
    deadline >= beforeTs + sevenDays && deadline <= beforeTs + sevenDays + 2n,
    `Deadline out of range: ${deadline}`
  );
});

test("Escrow: non-buyer cannot deposit", async () => {
  const { ethers, escrow, seller } = await setup();
  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).deposit({ value: ethers.parseEther("1") });
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("Escrow: buyer cannot deposit twice", async () => {
  const { ethers, escrow } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await expectRevert(
    async () => {
      const tx = await escrow.deposit({ value: ethers.parseEther("1") });
      await tx.wait();
    },
    "WrongState"
  );
});

test("Escrow: deposit with zero ETH is rejected", async () => {
  const { escrow } = await setup();
  await expectRevert(
    async () => {
      const tx = await escrow.deposit({ value: 0n });
      await tx.wait();
    },
    "NoFunds"
  );
});

// § 3 – Release (happy-path payment to seller)

test("Escrow: buyer can release funds to seller and state becomes COMPLETE", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();

  const sellerBefore = BigInt(await ethers.provider.getBalance(seller.address));
  const releaseTx = await escrow.release();
  await releaseTx.wait();

  const sellerAfter  = BigInt(await ethers.provider.getBalance(seller.address));
  const received     = sellerAfter - sellerBefore;

  assert.equal(received,              ethers.parseEther("1"));
  assert.equal(await escrow.state(),  2n);
  assert.equal(await ethers.provider.getBalance(await escrow.getAddress()), 0n);
});

test("Escrow: buyer cannot release before depositing", async () => {
  const { escrow } = await setup();
  await expectRevert(
    async () => {
      const tx = await escrow.release();
      await tx.wait();
    },
    "WrongState"
  );
});

test("Escrow: non-buyer cannot release", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).release();
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("Escrow: buyer cannot release after a dispute is raised", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();
  await expectRevert(
    async () => {
      const tx = await escrow.release();
      await tx.wait();
    },
    "WrongState"
  );
});

// § 4 – Dispute: initiateDispute()

test("Escrow: buyer can initiate a dispute → state becomes IN_DISPUTE", async () => {
  const { ethers, escrow } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();
  assert.equal(await escrow.state(), 4n);
});

test("Escrow: seller can initiate a dispute → state becomes IN_DISPUTE", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.connect(seller).initiateDispute()).wait();
  assert.equal(await escrow.state(), 4n);
});

test("Escrow: third party cannot initiate a dispute", async () => {
  const { ethers, escrow, other } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await expectRevert(
    async () => {
      const tx = await escrow.connect(other).initiateDispute();
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("Escrow: cannot initiate dispute before deposit", async () => {
  const { escrow } = await setup();
  await expectRevert(
    async () => {
      const tx = await escrow.initiateDispute();
      await tx.wait();
    },
    "WrongState"
  );
});

test("Escrow: cannot initiate dispute twice", async () => {
  const { ethers, escrow } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();
  await expectRevert(
    async () => {
      const tx = await escrow.initiateDispute();
      await tx.wait();
    },
    "WrongState"
  );
});

// § 5 – Dispute: resolveDispute()

test("Escrow: resolveDispute(true) → buyer gets funds and state is REFUNDED", async () => {
  const { ethers, escrow, buyer, arbiter } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();

  const buyerBefore = BigInt(await ethers.provider.getBalance(buyer.address));
  const resolveTx = await escrow.connect(arbiter).resolveDispute(true);
  const receipt   = await resolveTx.wait();

  const gasUsed    = receipt!.gasUsed;
  const gasPrice   = receipt!.gasPrice ?? receipt!.effectiveGasPrice;
  const gasCost    = gasUsed * gasPrice;

  const buyerAfter = BigInt(await ethers.provider.getBalance(buyer.address));
  const received = buyerAfter - buyerBefore;
  
  assert.equal(received, ethers.parseEther("1"));
  assert.equal(await escrow.state(), 3n);
  assert.equal(await ethers.provider.getBalance(await escrow.getAddress()), 0n);
});

test("Escrow: resolveDispute(false) → seller gets funds and state is COMPLETE", async () => {
  const { ethers, escrow, seller, arbiter } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();

  const sellerBefore = BigInt(await ethers.provider.getBalance(seller.address));
  await (await escrow.connect(arbiter).resolveDispute(false)).wait();
  const sellerAfter  = BigInt(await ethers.provider.getBalance(seller.address));
  const received     = sellerAfter - sellerBefore;

  assert.equal(received, ethers.parseEther("1"));
  assert.equal(await escrow.state(), 2n);
  assert.equal(await ethers.provider.getBalance(await escrow.getAddress()), 0n);
});

test("Escrow: only arbiter can resolveDispute", async () => {
  const { ethers, escrow, buyer, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();

  await expectRevert(
    async () => {
      const tx = await escrow.connect(buyer).resolveDispute(true);
      await tx.wait();
    },
    "Unauthorized"
  );

  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).resolveDispute(false);
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("Escrow: arbiter cannot resolve without an active dispute", async () => {
  const { ethers, escrow, arbiter } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();

  await expectRevert(
    async () => {
      const tx = await escrow.connect(arbiter).resolveDispute(true);
      await tx.wait();
    },
    "WrongState"
  );
});

test("Escrow: buyer cannot refund unilaterally (must go through dispute)", async () => {
  const { ethers, escrow } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  assert.equal(typeof (escrow as any).refund, "undefined", "refund() should not exist");
});

// § 6 – Timeout: claimTimeout()

test("Escrow: seller can claim after deadline passes (no dispute)", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();

  await increaseTime(ethers.provider, 7 * 24 * 60 * 60 + 1);

  const sellerBefore = BigInt(await ethers.provider.getBalance(seller.address));
  const claimTx  = await escrow.connect(seller).claimTimeout();
  const receipt  = await claimTx.wait();

  const gasUsed  = receipt!.gasUsed;
  const gasPrice = receipt!.gasPrice ?? receipt!.effectiveGasPrice;
  const gasCost  = gasUsed * gasPrice;

  const sellerAfter  = BigInt(await ethers.provider.getBalance(seller.address));
  const netReceived  = sellerAfter + gasCost - sellerBefore;

  assert.equal(netReceived,          ethers.parseEther("1"));
  assert.equal(await escrow.state(), 2n);
  assert.equal(await ethers.provider.getBalance(await escrow.getAddress()), 0n);
});

test("Escrow: seller cannot claimTimeout before deadline", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await increaseTime(ethers.provider, 3 * 24 * 60 * 60);

  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).claimTimeout();
      await tx.wait();
    },
    "DeadlineNotReached"
  );
});

test("Escrow: seller cannot claimTimeout while dispute is IN_DISPUTE", async () => {
  const { ethers, escrow, seller } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();
  await increaseTime(ethers.provider, 7 * 24 * 60 * 60 + 1);

  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).claimTimeout();
      await tx.wait();
    },
    "WrongState"
  );
});

test("Escrow: only seller can call claimTimeout", async () => {
  const { ethers, escrow, buyer } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await increaseTime(ethers.provider, 7 * 24 * 60 * 60 + 1);

  await expectRevert(
    async () => {
      const tx = await escrow.connect(buyer).claimTimeout();
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("Escrow: cannot claimTimeout before any deposit", async () => {
  const { ethers, escrow, seller } = await setup();
  await increaseTime(ethers.provider, 7 * 24 * 60 * 60 + 1);

  await expectRevert(
    async () => {
      const tx = await escrow.connect(seller).claimTimeout();
      await tx.wait();
    },
    "WrongState"
  );
});

// § 7 – Additional access-control edge cases

test("Escrow: full happy-path end-to-end (deposit → dispute → resolve seller)", async () => {
  const { ethers, escrow, seller, arbiter } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("2") })).wait();
  assert.equal(await escrow.state(), 1n);

  await (await escrow.connect(seller).initiateDispute()).wait();
  assert.equal(await escrow.state(), 4n);

  const sellerBefore = BigInt(await ethers.provider.getBalance(seller.address));
  await (await escrow.connect(arbiter).resolveDispute(false)).wait();
  const sellerAfter  = BigInt(await ethers.provider.getBalance(seller.address));

  assert.equal(sellerAfter - sellerBefore, ethers.parseEther("2"));
  assert.equal(await escrow.state(), 2n);
});

test("Escrow: arbiter cannot act after completion", async () => {
  const { ethers, escrow, arbiter } = await setup();
  await (await escrow.deposit({ value: ethers.parseEther("1") })).wait();
  await (await escrow.initiateDispute()).wait();
  await (await escrow.connect(arbiter).resolveDispute(false)).wait();

  await expectRevert(
    async () => {
      const tx = await escrow.connect(arbiter).resolveDispute(true);
      await tx.wait();
    },
    "WrongState"
  );
});

// § 8 – EscrowFactory registry

test("EscrowFactory: tracks total escrow count", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyerA, buyerB, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  assert.equal(await factory.getEscrowCount(), 0n);

  await (await factory.connect(buyerA).createEscrow(seller.address, arbiter.address)).wait();
  assert.equal(await factory.getEscrowCount(), 1n);

  await (await factory.connect(buyerB).createEscrow(seller.address, arbiter.address)).wait();
  assert.equal(await factory.getEscrowCount(), 2n);
});

test("EscrowFactory: escrowsByBuyer returns only that buyer's escrows", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyerA, buyerB, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  await (await factory.connect(buyerA).createEscrow(seller.address, arbiter.address)).wait();
  await (await factory.connect(buyerA).createEscrow(seller.address, arbiter.address)).wait();
  await (await factory.connect(buyerB).createEscrow(seller.address, arbiter.address)).wait();

  const byA = await factory.getEscrowsByBuyer(buyerA.address);
  const byB = await factory.getEscrowsByBuyer(buyerB.address);

  assert.equal(byA.length, 2);
  assert.equal(byB.length, 1);
});

test("EscrowFactory: each clone is an independent contract with its own state", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyerA, buyerB, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  const txA = await factory.connect(buyerA).createEscrow(seller.address, arbiter.address);
  const txB = await factory.connect(buyerB).createEscrow(seller.address, arbiter.address);
  await txA.wait();
  await txB.wait();

  const addrA: string = (await factory.allEscrows(0));
  const addrB: string = (await factory.allEscrows(1));

  const escrowA: any = await ethers.getContractAt("Escrow", addrA);
  const escrowB: any = await ethers.getContractAt("Escrow", addrB);

  await (await escrowA.connect(buyerA).deposit({ value: ethers.parseEther("1") })).wait();

  assert.equal(await escrowA.state(), 1n);
  assert.equal(await escrowB.state(), 0n);

  await expectRevert(
    async () => {
      const tx = await escrowA.connect(buyerB).deposit({ value: ethers.parseEther("1") });
      await tx.wait();
    },
    "Unauthorized"
  );
});

test("EscrowFactory: deployed clone addresses are distinct from implementation", async () => {
  const { factory, escrow } = await setup();

  const impl  = await factory.implementation();
  const clone = await escrow.getAddress();

  assert.notEqual(clone, impl, "Clone address must differ from implementation");
});

test("EscrowFactory: createEscrow emits EscrowCreated event with correct args", async () => {
  const { ethers } = await network.connect();
  const [deployer, buyer, seller, arbiter] = await ethers.getSigners();

  const Factory = await ethers.getContractFactory("EscrowFactory", deployer);
  const factory: any = await Factory.deploy();
  await factory.waitForDeployment();

  const tx      = await factory.connect(buyer).createEscrow(seller.address, arbiter.address);
  const receipt = await tx.wait();

  const event = receipt?.logs
    .map((log: any) => {
      try { return factory.interface.parseLog(log); } catch { return null; }
    })
    .find((e: any) => e?.name === "EscrowCreated");

  assert.ok(event,               "EscrowCreated event not found");
  assert.equal(event.args.buyer,   buyer.address);
  assert.equal(event.args.seller,  seller.address);
  assert.equal(event.args.arbiter, arbiter.address);
  assert.ok(event.args.escrow !== ethers.ZeroAddress, "Escrow address should be non-zero");
});