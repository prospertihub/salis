const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("SalisToken", function () {
  let SalisToken;
  let token;
  let owner;
  let user1;
  let user2;
  let addrs;

  beforeEach(async function () {
    [owner, user1, user2, ...addrs] = await ethers.getSigners();
    
    SalisToken = await ethers.getContractFactory("SalisToken");
    const initialSupply = ethers.parseEther("1000000");
    const maxSupply = ethers.parseEther("10000000");
    const ndaHash = ethers.keccak256(ethers.toUtf8Bytes("Test NDA Content"));
    token = await SalisToken.deploy("TestToken", "TEST", initialSupply, maxSupply, ndaHash);
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await token.owner()).to.equal(owner.address);
    });

    it("Should assign the initial supply to the owner", async function () {
      const ownerBalance = await token.balanceOf(owner.address);
      expect(await token.totalSupply()).to.equal(ownerBalance);
    });

    it("Should set the correct name and symbol", async function () {
      expect(await token.name()).to.equal("TestToken");
      expect(await token.symbol()).to.equal("TEST");
    });

    it("Should have 18 decimals", async function () {
      expect(await token.decimals()).to.equal(18);
    });

    it("Should set the correct max supply", async function () {
      expect(await token.maxSupply()).to.equal(ethers.parseEther("10000000"));
    });

    it("Should not be paused initially", async function () {
      expect(await token.paused()).to.be.false;
    });

    it("Should not have minting paused initially", async function () {
      expect(await token.mintingPaused()).to.be.false;
    });
  });

  describe("Time-Lock Functionality", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should distribute locked tokens correctly", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;
      const currentTime = await time.latest();

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      expect(await token.lockedBalanceOf(user1.address)).to.equal(lockAmount);
      const releaseTime = await token.lockReleaseTimeOf(user1.address);
      expect(releaseTime).to.be.gt(currentTime);
      // User now has 1000 (from beforeEach) + 100 (from distributeLocked) = 1100 total
      // But 100 is locked, so transferable is 1000
      expect(await token.transferableBalanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should not allow non-owner to distribute locked tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await expect(
        token.connect(user1).distributeLocked(user2.address, lockAmount, daysLock)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow distributing to zero address", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await expect(
        token.distributeLocked(ethers.ZeroAddress, lockAmount, daysLock)
      ).to.be.revertedWith("SalisToken: Cannot lock to zero address");
    });

    it("Should not allow zero amount distribution", async function () {
      const daysLock = 30;

      await expect(
        token.distributeLocked(user1.address, 0, daysLock)
      ).to.be.revertedWith("SalisToken: Amount must be greater than 0");
    });

    it("Should not allow zero days lock", async function () {
      const lockAmount = ethers.parseEther("100");

      await expect(
        token.distributeLocked(user1.address, lockAmount, 0)
      ).to.be.revertedWith("SalisToken: Lock period must be greater than 0");
    });

    it("Should not allow distributing more than owner balance", async function () {
      const lockAmount = ethers.parseEther("2000000"); // More than owner has
      const daysLock = 30;

      await expect(
        token.distributeLocked(user1.address, lockAmount, daysLock)
      ).to.be.revertedWith("SalisToken: Insufficient balance to distribute");
    });

    it("Should extend lock time when new lock is later", async function () {
      const lockAmount1 = ethers.parseEther("100");
      const lockAmount2 = ethers.parseEther("50");
      const daysLock1 = 30;
      const daysLock2 = 60;

      await token.distributeLocked(user1.address, lockAmount1, daysLock1);
      const firstReleaseTime = await token.lockReleaseTimeOf(user1.address);

      await token.distributeLocked(user1.address, lockAmount2, daysLock2);
      const secondReleaseTime = await token.lockReleaseTimeOf(user1.address);

      expect(secondReleaseTime).to.be.gt(firstReleaseTime);
      expect(await token.lockedBalanceOf(user1.address)).to.equal(lockAmount1 + lockAmount2);
    });

    it("Should keep existing lock time when new lock is earlier", async function () {
      const lockAmount1 = ethers.parseEther("100");
      const lockAmount2 = ethers.parseEther("50");
      const daysLock1 = 60;
      const daysLock2 = 30;

      await token.distributeLocked(user1.address, lockAmount1, daysLock1);
      const firstReleaseTime = await token.lockReleaseTimeOf(user1.address);

      await token.distributeLocked(user1.address, lockAmount2, daysLock2);
      const secondReleaseTime = await token.lockReleaseTimeOf(user1.address);

      expect(secondReleaseTime).to.equal(firstReleaseTime);
      expect(await token.lockedBalanceOf(user1.address)).to.equal(lockAmount1 + lockAmount2);
    });

    it("Should prevent transfers of locked tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      // User has 1100 total (1000 + 100), but 100 is locked, so can only transfer 1000
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("1050"))
      ).to.be.revertedWith("SalisToken: Insufficient transferable balance");
    });

    it("Should allow transfers of unlocked tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      // Transfer should succeed for transferable amount (1000)
      await token.connect(user1).transfer(user2.address, ethers.parseEther("500"));
      expect(await token.balanceOf(user2.address)).to.equal(ethers.parseEther("500"));
    });

    it("Should automatically unlock expired tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 1; // 1 day lock

      await token.distributeLocked(user1.address, lockAmount, daysLock);
      
      // Fast forward time by 2 days
      await time.increase(2 * 24 * 60 * 60);

      // Locked balance should be 0 after expiry
      expect(await token.lockedBalanceOf(user1.address)).to.equal(0);
      
      // All balance should be transferable (1100 total)
      expect(await token.transferableBalanceOf(user1.address)).to.equal(ethers.parseEther("1100"));
    });

    it("Should allow manual unlocking of expired tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 1; // 1 day lock

      await token.distributeLocked(user1.address, lockAmount, daysLock);
      
      // Fast forward time by 2 days
      await time.increase(2 * 24 * 60 * 60);

      await token.unlockExpired(user1.address);
      
      expect(await token.lockedBalanceOf(user1.address)).to.equal(0);
      expect(await token.lockReleaseTimeOf(user1.address)).to.equal(0);
    });

    it("Should not allow unlocking non-expired tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      await expect(
        token.unlockExpired(user1.address)
      ).to.be.revertedWith("SalisToken: Lock has not expired");
    });

    it("Should not allow unlocking when no locked tokens exist", async function () {
      await expect(
        token.unlockExpired(user1.address)
      ).to.be.revertedWith("SalisToken: No locked tokens");
    });

    it("Should return correct balance information", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      const balanceInfo = await token.getBalanceInfo(user1.address);
      
      expect(balanceInfo.totalBalance).to.equal(ethers.parseEther("1100")); // 1000 + 100
      expect(balanceInfo.lockedBalance).to.equal(lockAmount);
      expect(balanceInfo.transferableBalance).to.equal(ethers.parseEther("1000"));
      expect(balanceInfo.lockReleaseTime).to.be.gt(0);
    });

    it("Should handle multiple locks correctly", async function () {
      const lockAmount1 = ethers.parseEther("100");
      const lockAmount2 = ethers.parseEther("50");
      const daysLock1 = 30;
      const daysLock2 = 60;

      await token.distributeLocked(user1.address, lockAmount1, daysLock1);
      await token.distributeLocked(user1.address, lockAmount2, daysLock2);

      expect(await token.lockedBalanceOf(user1.address)).to.equal(lockAmount1 + lockAmount2);
      // Total: 1000 + 100 + 50 = 1150, locked: 150, transferable: 1000
      expect(await token.transferableBalanceOf(user1.address)).to.equal(ethers.parseEther("1000"));
    });

    it("Should emit correct events for locked distribution", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      const tx = await token.distributeLocked(user1.address, lockAmount, daysLock);
      const receipt = await tx.wait();
      
      // Find the Locked event in the transaction receipt
      const lockedEvent = receipt.logs.find(log => {
        try {
          const parsed = token.interface.parseLog(log);
          return parsed.name === "Locked";
        } catch {
          return false;
        }
      });
      
      expect(lockedEvent).to.not.be.undefined;
      const parsedEvent = token.interface.parseLog(lockedEvent);
      expect(parsedEvent.args.to).to.equal(user1.address);
      expect(parsedEvent.args.amount).to.equal(lockAmount);
      expect(parsedEvent.args.releaseTime).to.be.gt(0);
    });

    it("Should emit correct events for lock extension", async function () {
      const lockAmount1 = ethers.parseEther("100");
      const lockAmount2 = ethers.parseEther("50");
      const daysLock1 = 30;
      const daysLock2 = 60;

      await token.distributeLocked(user1.address, lockAmount1, daysLock1);
      const firstReleaseTime = await token.lockReleaseTimeOf(user1.address);

      const tx = await token.distributeLocked(user1.address, lockAmount2, daysLock2);
      const receipt = await tx.wait();
      
      // Find the LockExtended event in the transaction receipt
      const lockExtendedEvent = receipt.logs.find(log => {
        try {
          const parsed = token.interface.parseLog(log);
          return parsed.name === "LockExtended";
        } catch {
          return false;
        }
      });
      
      expect(lockExtendedEvent).to.not.be.undefined;
      const parsedEvent = token.interface.parseLog(lockExtendedEvent);
      expect(parsedEvent.args.to).to.equal(user1.address);
      expect(parsedEvent.args.oldRelease).to.equal(firstReleaseTime);
      expect(parsedEvent.args.newRelease).to.be.gt(firstReleaseTime);
    });

    it("Should emit correct events for unlocking", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 1;

      await token.distributeLocked(user1.address, lockAmount, daysLock);
      await time.increase(2 * 24 * 60 * 60);

      await expect(token.unlockExpired(user1.address))
        .to.emit(token, "Unlocked")
        .withArgs(user1.address, lockAmount);
    });
  });

  describe("Minting", function () {
    it("Should allow owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await token.mint(user1.address, mintAmount);
      expect(await token.balanceOf(user1.address)).to.equal(mintAmount);
    });

    it("Should not allow non-owner to mint tokens", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        token.connect(user1).mint(user2.address, mintAmount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow minting to zero address", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(
        token.mint(ethers.ZeroAddress, mintAmount)
      ).to.be.revertedWith("SalisToken: Cannot mint to zero address");
    });

    it("Should not allow minting zero amount", async function () {
      await expect(
        token.mint(user1.address, 0)
      ).to.be.revertedWith("SalisToken: Amount must be greater than 0");
    });

    it("Should not allow minting beyond max supply", async function () {
      const maxSupply = await token.maxSupply();
      const currentSupply = await token.totalSupply();
      const remaining = maxSupply - currentSupply;
      const tooMuch = remaining + ethers.parseEther("1");
      
      await expect(
        token.mint(user1.address, tooMuch)
      ).to.be.revertedWith("SalisToken: Would exceed max supply");
    });

    it("Should emit TokensMinted event", async function () {
      const mintAmount = ethers.parseEther("1000");
      await expect(token.mint(user1.address, mintAmount))
        .to.emit(token, "TokensMinted")
        .withArgs(user1.address, mintAmount);
    });
  });

  describe("Burning", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow users to burn their own tokens", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await token.balanceOf(user1.address);
      await token.connect(user1).burn(burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should allow owner to burn tokens from any address", async function () {
      const burnAmount = ethers.parseEther("100");
      const initialBalance = await token.balanceOf(user1.address);
      await token.burnFrom(user1.address, burnAmount);
      expect(await token.balanceOf(user1.address)).to.equal(initialBalance - burnAmount);
    });

    it("Should not allow non-owner to burn tokens from other addresses", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(
        token.connect(user2).burnFrom(user1.address, burnAmount)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow burning zero amount", async function () {
      await expect(
        token.connect(user1).burn(0)
      ).to.be.revertedWith("SalisToken: Amount must be greater than 0");
    });

    it("Should not allow burning locked tokens", async function () {
      const lockAmount = ethers.parseEther("100");
      const daysLock = 30;

      await token.distributeLocked(user1.address, lockAmount, daysLock);

      // User has 1100 total, but 100 is locked, so can only burn 1000
      await expect(
        token.connect(user1).burn(ethers.parseEther("1050"))
      ).to.be.revertedWith("SalisToken: Insufficient transferable balance");
    });

    it("Should emit TokensBurned event", async function () {
      const burnAmount = ethers.parseEther("100");
      await expect(token.connect(user1).burn(burnAmount))
        .to.emit(token, "TokensBurned")
        .withArgs(user1.address, burnAmount);
    });
  });

  describe("Blacklisting", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
      await token.mint(user2.address, ethers.parseEther("1000"));
    });

    it("Should allow owner to blacklist an address", async function () {
      await token.setBlacklist(user1.address, true);
      expect(await token.isBlacklisted(user1.address)).to.be.true;
    });

    it("Should allow owner to unblacklist an address", async function () {
      await token.setBlacklist(user1.address, true);
      await token.setBlacklist(user1.address, false);
      expect(await token.isBlacklisted(user1.address)).to.be.false;
    });

    it("Should not allow non-owner to blacklist addresses", async function () {
      await expect(
        token.connect(user1).setBlacklist(user2.address, true)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow blacklisting zero address", async function () {
      await expect(
        token.setBlacklist(ethers.ZeroAddress, true)
      ).to.be.revertedWith("SalisToken: Cannot blacklist zero address");
    });

    it("Should emit BlacklistUpdated event", async function () {
      await expect(token.setBlacklist(user1.address, true))
        .to.emit(token, "BlacklistUpdated")
        .withArgs(user1.address, true);
    });

    it("Should prevent blacklisted addresses from transferring", async function () {
      await token.setBlacklist(user1.address, true);
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Account is blacklisted");
    });

    it("Should prevent transfers to blacklisted addresses", async function () {
      await token.setBlacklist(user2.address, true);
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Account is blacklisted");
    });

    it("Should prevent blacklisted addresses from minting", async function () {
      await token.setBlacklist(user1.address, true);
      await expect(
        token.mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Account is blacklisted");
    });
  });

  describe("Pausing", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should allow owner to pause transfers", async function () {
      await token.pause();
      expect(await token.paused()).to.be.true;
    });

    it("Should allow owner to unpause transfers", async function () {
      await token.pause();
      await token.unpause();
      expect(await token.paused()).to.be.false;
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        token.connect(user1).pause()
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should prevent transfers when paused", async function () {
      await token.pause();
      await expect(
        token.connect(user1).transfer(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "EnforcedPause");
    });

    it("Should allow owner to pause minting", async function () {
      await token.pauseMinting();
      expect(await token.mintingPaused()).to.be.true;
    });

    it("Should allow owner to resume minting", async function () {
      await token.pauseMinting();
      await token.resumeMinting();
      expect(await token.mintingPaused()).to.be.false;
    });

    it("Should prevent minting when minting is paused", async function () {
      await token.pauseMinting();
      await expect(
        token.mint(user1.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Minting is paused");
    });

    it("Should emit MintingPaused event", async function () {
      await expect(token.pauseMinting())
        .to.emit(token, "MintingPaused")
        .withArgs(owner.address);
    });

    it("Should emit MintingResumed event", async function () {
      await token.pauseMinting();
      await expect(token.resumeMinting())
        .to.emit(token, "MintingResumed")
        .withArgs(owner.address);
    });
  });

  describe("Max Supply Management", function () {
    it("Should allow owner to update max supply", async function () {
      const newMaxSupply = ethers.parseEther("20000000");
      await token.setMaxSupply(newMaxSupply);
      expect(await token.maxSupply()).to.equal(newMaxSupply);
    });

    it("Should not allow non-owner to update max supply", async function () {
      const newMaxSupply = ethers.parseEther("20000000");
      await expect(
        token.connect(user1).setMaxSupply(newMaxSupply)
      ).to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount");
    });

    it("Should not allow setting max supply below current supply", async function () {
      const currentSupply = await token.totalSupply();
      const newMaxSupply = currentSupply - ethers.parseEther("1");
      await expect(
        token.setMaxSupply(newMaxSupply)
      ).to.be.revertedWith("SalisToken: Max supply must be >= current supply");
    });

    it("Should emit MaxSupplyUpdated event", async function () {
      const oldMaxSupply = await token.maxSupply();
      const newMaxSupply = ethers.parseEther("20000000");
      await expect(token.setMaxSupply(newMaxSupply))
        .to.emit(token, "MaxSupplyUpdated")
        .withArgs(oldMaxSupply, newMaxSupply);
    });

    it("Should return correct remaining mintable supply", async function () {
      const maxSupply = await token.maxSupply();
      const currentSupply = await token.totalSupply();
      const remaining = await token.getRemainingMintableSupply();
      expect(remaining).to.equal(maxSupply - currentSupply);
    });
  });

  describe("Transfers", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should transfer tokens between accounts", async function () {
      const transferAmount = ethers.parseEther("100");
      await token.connect(user1).transfer(user2.address, transferAmount);
      
      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("900"));
      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
    });

    it("Should fail if sender doesn't have enough tokens", async function () {
      const transferAmount = ethers.parseEther("10000");
      await expect(
        token.connect(user1).transfer(user2.address, transferAmount)
      ).to.be.revertedWith("SalisToken: Insufficient transferable balance");
    });

    it("Should update balances after transfers", async function () {
      const initialOwnerBalance = await token.balanceOf(owner.address);

      await token.transfer(user1.address, ethers.parseEther("100"));
      await token.transfer(user2.address, ethers.parseEther("50"));

      const finalOwnerBalance = await token.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - ethers.parseEther("150"));

      const user1Balance = await token.balanceOf(user1.address);
      expect(user1Balance).to.equal(ethers.parseEther("1100")); // 1000 from beforeEach + 100 from transfer

      const user2Balance = await token.balanceOf(user2.address);
      expect(user2Balance).to.equal(ethers.parseEther("50"));
    });
  });

  describe("Allowances", function () {
    beforeEach(async function () {
      await token.mint(user1.address, ethers.parseEther("1000"));
    });

    it("Should approve and transfer from", async function () {
      const approveAmount = ethers.parseEther("100");
      const transferAmount = ethers.parseEther("50");

      await token.connect(user1).approve(user2.address, approveAmount);
      await token.connect(user2).transferFrom(user1.address, user2.address, transferAmount);

      expect(await token.balanceOf(user1.address)).to.equal(ethers.parseEther("950"));
      expect(await token.balanceOf(user2.address)).to.equal(transferAmount);
      expect(await token.allowance(user1.address, user2.address)).to.equal(ethers.parseEther("50"));
    });

    it("Should fail transferFrom if not approved", async function () {
      await expect(
        token.connect(user2).transferFrom(user1.address, user2.address, ethers.parseEther("100"))
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should prevent approval for blacklisted spender", async function () {
      await token.setBlacklist(user2.address, true);
      await expect(
        token.connect(user1).approve(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Account is blacklisted");
    });

    it("Should prevent approval from blacklisted owner", async function () {
      await token.setBlacklist(user1.address, true);
      await expect(
        token.connect(user1).approve(user2.address, ethers.parseEther("100"))
      ).to.be.revertedWith("SalisToken: Account is blacklisted");
    });
  });

  describe("Token Information", function () {
    it("Should return correct token information", async function () {
      const tokenInfo = await token.getTokenInfo();
      
      expect(tokenInfo.name).to.equal("TestToken");
      expect(tokenInfo.symbol).to.equal("TEST");
      expect(tokenInfo.decimals).to.equal(18);
      expect(tokenInfo.totalSupply).to.equal(ethers.parseEther("1000000"));
      expect(tokenInfo.maxSupplyValue).to.equal(ethers.parseEther("10000000"));
      expect(tokenInfo.remainingMintable).to.equal(ethers.parseEther("9000000"));
    });

    it("Should return correct blacklist status", async function () {
      expect(await token.isAddressBlacklisted(user1.address)).to.be.false;
      await token.setBlacklist(user1.address, true);
      expect(await token.isAddressBlacklisted(user1.address)).to.be.true;
    });
  });

  describe("NDA Functionality", function () {
    it("Should have immutable NDA hash", async function () {
      const ndaHash = await token.getNDAHash();
      expect(ndaHash).to.not.equal(ethers.ZeroHash);
    });

    it("Should verify NDA compliance correctly", async function () {
      const correctHash = ethers.keccak256(ethers.toUtf8Bytes("Test NDA Content"));
      const wrongHash = ethers.keccak256(ethers.toUtf8Bytes("Wrong NDA Content"));
      
      expect(await token.verifyNDACompliance(correctHash)).to.be.true;
      expect(await token.verifyNDACompliance(wrongHash)).to.be.false;
    });

    it("Should include NDA hash in token info", async function () {
      const tokenInfo = await token.getTokenInfo();
      expect(tokenInfo.ndaHashValue).to.not.equal(ethers.ZeroHash);
      expect(tokenInfo.ndaHashValue).to.equal(await token.getNDAHash());
    });

    it("Should not allow zero NDA hash during deployment", async function () {
      const SalisToken = await ethers.getContractFactory("SalisToken");
      const initialSupply = ethers.parseEther("1000000");
      const maxSupply = ethers.parseEther("10000000");
      
      await expect(
        SalisToken.deploy("TestToken", "TEST", initialSupply, maxSupply, ethers.ZeroHash)
      ).to.be.revertedWith("SalisToken: NDA hash cannot be zero");
    });
  });
});
