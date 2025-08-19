const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SalisToken...");
  
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH");
  
  // Generate NDA hash
  console.log("\nGenerating NDA hash...");
  const ndaContent = "Sample NDA content for deployment";
  const ndaHash = ethers.keccak256(ethers.toUtf8Bytes(ndaContent));
  console.log("NDA Hash:", ndaHash);
  
  // Deploy SalisToken
  console.log("\nDeploying SalisToken...");
  const SalisToken = await ethers.getContractFactory("SalisToken");
  const initialSupply = ethers.parseEther("1000000"); // 1 million tokens
  const maxSupply = ethers.parseEther("10000000"); // 10 million tokens
  
  const token = await SalisToken.deploy(
    "SalisToken",
    "SATO",
    initialSupply,
    maxSupply,
    ndaHash
  );
  
  await token.waitForDeployment();
  const tokenAddress = await token.getAddress();
  
  console.log("SalisToken deployed to:", tokenAddress);
  console.log("Deployed by:", deployer.address);
  
  // Get token information
  const tokenInfo = await token.getTokenInfo();
  console.log("\n=== Token Information ===");
  console.log("Name:", tokenInfo[0]);
  console.log("Symbol:", tokenInfo[1]);
  console.log("Decimals:", tokenInfo[2]);
  console.log("Total Supply:", ethers.formatEther(tokenInfo[3]));
  console.log("Max Supply:", ethers.formatEther(tokenInfo[4]));
  console.log("Remaining Mintable:", ethers.formatEther(tokenInfo[5]));
  console.log("NDA Hash:", tokenInfo[6]);
  
  // Verify NDA compliance
  const isCompliant = await token.verifyNDACompliance(ndaHash);
  console.log("NDA Compliance:", isCompliant ? "Valid" : "Invalid");
  
  console.log("\n=== Deployment Summary ===");
  console.log("Contract Address:", tokenAddress);
  console.log("Deployer:", deployer.address);
  console.log("Network:", (await ethers.provider.getNetwork()).name);
  console.log("Block Number:", await ethers.provider.getBlockNumber());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
