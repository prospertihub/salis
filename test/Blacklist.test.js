const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("SalisToken Blacklist Functionality", function () {
    let SalisToken;
    let token;
    let owner;
    let user1;
    let user2;
    let user3;
    let user4;
    let user5;

        beforeEach(async function () {
        [owner, user1, user2, user3, user4, user5] = await ethers.getSigners();
        
        SalisToken = await ethers.getContractFactory("SalisToken");
        const ndaHash = ethers.keccak256(ethers.toUtf8Bytes("Test NDA Content"));
        token = await SalisToken.deploy(
          "SalisToken",
          "SATO",
          ethers.parseEther("1000000"), // 1M initial supply
          ethers.parseEther("10000000"), // 10M max supply
          ndaHash
        );
        await token.waitForDeployment();

        // Mint some tokens to users for testing
        await token.mint(user1.address, ethers.parseEther("1000"));
        await token.mint(user2.address, ethers.parseEther("1000"));
        await token.mint(user3.address, ethers.parseEther("1000"));
        await token.mint(user4.address, ethers.parseEther("1000"));
        await token.mint(user5.address, ethers.parseEther("1000"));
    });

    describe("Basic Blacklist Functionality", function () {
        it("Should allow owner to blacklist an address", async function () {
            await expect(token.setBlacklist(user1.address, true))
                .to.emit(token, "BlacklistUpdated")
                .withArgs(user1.address, true);
            
            expect(await token.isAddressBlacklisted(user1.address)).to.be.true;
            expect(await token.getBlacklistStats()).to.equal(1);
        });

        it("Should allow owner to unblacklist an address", async function () {
            await token.setBlacklist(user1.address, true);
            
            await expect(token.setBlacklist(user1.address, false))
                .to.emit(token, "BlacklistUpdated")
                .withArgs(user1.address, false);
            
            expect(await token.isAddressBlacklisted(user1.address)).to.be.false;
            expect(await token.getBlacklistStats()).to.equal(0);
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
    });

    describe("Transfer Restrictions", function () {
        beforeEach(async function () {
            // Blacklist user1 and user2
            await token.setBlacklist(user1.address, true);
            await token.setBlacklist(user2.address, true);
        });

        it("Should prevent blacklisted address from sending tokens", async function () {
            // user1 is blacklisted, should not be able to send
            await expect(
                token.connect(user1).transfer(user3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent sending tokens to blacklisted address", async function () {
            // user3 tries to send to user2 (blacklisted)
            await expect(
                token.connect(user3).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent transferFrom when from address is blacklisted", async function () {
            // user3 approves user4 to spend tokens
            await token.connect(user3).approve(user4.address, ethers.parseEther("100"));
            
            // user4 tries to transferFrom user3 to user1 (blacklisted)
            await expect(
                token.connect(user4).transferFrom(user3.address, user1.address, ethers.parseEther("50"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent transferFrom when to address is blacklisted", async function () {
            // user3 approves user4 to spend tokens
            await token.connect(user3).approve(user4.address, ethers.parseEther("100"));
            
            // user4 tries to transferFrom user3 to user2 (blacklisted)
            await expect(
                token.connect(user4).transferFrom(user3.address, user2.address, ethers.parseEther("50"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should allow normal transfers between non-blacklisted addresses", async function () {
            // user3 sends to user4 (both not blacklisted)
            await expect(
                token.connect(user3).transfer(user4.address, ethers.parseEther("100"))
            ).to.not.be.reverted;
            
            expect(await token.balanceOf(user4.address)).to.equal(ethers.parseEther("1100"));
        });

        it("Should prevent blacklisted address from approving spender", async function () {
            await expect(
                token.connect(user1).approve(user3.address, ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent approving blacklisted address as spender", async function () {
            await expect(
                token.connect(user3).approve(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });
    });

    describe("Batch Blacklist Operations", function () {
        it("Should allow owner to blacklist multiple addresses at once", async function () {
            const addresses = [user1.address, user2.address, user3.address];
            
            await expect(token.setBlacklistBatch(addresses, true))
                .to.emit(token, "BlacklistBatchUpdated")
                .withArgs(addresses, true);
            
            expect(await token.getBlacklistStats()).to.equal(3);
            expect(await token.isAddressBlacklisted(user1.address)).to.be.true;
            expect(await token.isAddressBlacklisted(user2.address)).to.be.true;
            expect(await token.isAddressBlacklisted(user3.address)).to.be.true;
        });

        it("Should allow owner to unblacklist multiple addresses at once", async function () {
            const addresses = [user1.address, user2.address, user3.address];
            
            // First blacklist them
            await token.setBlacklistBatch(addresses, true);
            
            // Then unblacklist them
            await expect(token.setBlacklistBatch(addresses, false))
                .to.emit(token, "BlacklistBatchUpdated")
                .withArgs(addresses, false);
            
            expect(await token.getBlacklistStats()).to.equal(0);
            expect(await token.isAddressBlacklisted(user1.address)).to.be.false;
            expect(await token.isAddressBlacklisted(user2.address)).to.be.false;
            expect(await token.isAddressBlacklisted(user3.address)).to.be.false;
        });

        it("Should not allow empty array for batch operations", async function () {
            await expect(
                token.setBlacklistBatch([], true)
            ).to.be.revertedWith("SalisToken: Empty accounts array");
        });

        it("Should not allow too many addresses in batch operation", async function () {
            const addresses = Array(101).fill(user1.address);
            await expect(
                token.setBlacklistBatch(addresses, true)
            ).to.be.revertedWith("SalisToken: Too many accounts (max 100)");
        });

        it("Should not allow zero address in batch operations", async function () {
            const addresses = [user1.address, ethers.ZeroAddress, user2.address];
            await expect(
                token.setBlacklistBatch(addresses, true)
            ).to.be.revertedWith("SalisToken: Cannot blacklist zero address");
        });
    });

    describe("Blacklist Query Functions", function () {
        beforeEach(async function () {
            // Blacklist some users
            await token.setBlacklist(user1.address, true);
            await token.setBlacklist(user2.address, true);
            await token.setBlacklist(user3.address, true);
        });

        it("Should return correct blacklist status for multiple addresses", async function () {
            const addresses = [user1.address, user2.address, user3.address, user4.address, user5.address];
            const expected = [true, true, true, false, false];
            
            const results = await token.areAddressesBlacklisted(addresses);
            expect(results).to.deep.equal(expected);
        });

        it("Should return correct blacklist statistics", async function () {
            expect(await token.getBlacklistStats()).to.equal(3);
            
            // Unblacklist one user
            await token.setBlacklist(user1.address, false);
            expect(await token.getBlacklistStats()).to.equal(2);
        });
    });

    describe("Integration with Other Functions", function () {
        it("Should prevent minting to blacklisted address", async function () {
            await token.setBlacklist(user1.address, true);
            
            await expect(
                token.mint(user1.address, ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent blacklisted address from burning their own tokens", async function () {
            await token.setBlacklist(user1.address, true);
            
            await expect(
                token.connect(user1).burn(ethers.parseEther("100"))
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });

        it("Should prevent distributing locked tokens to blacklisted address", async function () {
            await token.setBlacklist(user1.address, true);
            
            await expect(
                token.distributeLocked(user1.address, ethers.parseEther("100"), 30)
            ).to.be.revertedWith("SalisToken: Account is blacklisted");
        });
    });

    describe("Edge Cases", function () {
        it("Should handle double blacklisting gracefully", async function () {
            await token.setBlacklist(user1.address, true);
            expect(await token.getBlacklistStats()).to.equal(1);
            
            // Blacklist again
            await token.setBlacklist(user1.address, true);
            expect(await token.getBlacklistStats()).to.equal(1); // Count shouldn't change
        });

        it("Should handle double unblacklisting gracefully", async function () {
            await token.setBlacklist(user1.address, true);
            await token.setBlacklist(user1.address, false);
            expect(await token.getBlacklistStats()).to.equal(0);
            
            // Unblacklist again
            await token.setBlacklist(user1.address, false);
            expect(await token.getBlacklistStats()).to.equal(0); // Count shouldn't change
        });

        it("Should maintain correct count with mixed operations", async function () {
            // Blacklist 3 users
            await token.setBlacklist(user1.address, true);
            await token.setBlacklist(user2.address, true);
            await token.setBlacklist(user3.address, true);
            expect(await token.getBlacklistStats()).to.equal(3);
            
            // Unblacklist 1 user
            await token.setBlacklist(user1.address, false);
            expect(await token.getBlacklistStats()).to.equal(2);
            
            // Blacklist 2 more users
            await token.setBlacklist(user4.address, true);
            await token.setBlacklist(user5.address, true);
            expect(await token.getBlacklistStats()).to.equal(4);
        });
    });
});
