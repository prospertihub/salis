# Deployment Guide - SalisToken

## Prerequisites
- Node.js 18+ installed
- npm or yarn package manager
- Hardhat development environment
- Ethereum wallet with sufficient funds

## Installation
```bash
npm install
```

## Configuration
1. Copy environment file:
   ```bash
   cp env.example .env
   ```

2. Configure your environment variables:
   ```
   PRIVATE_KEYS=your_private_key_here
   POLYGON_RPC_URL=your_polygon_rpc_url
   MUMBAI_RPC_URL=your_mumbai_rpc_url
   ```

## Compilation
```bash
npx hardhat compile
```

## Testing
```bash
npm test
```

## Local Deployment
```bash
# Start local network
npx hardhat node

# Deploy to local network
npx hardhat run scripts/deploy-simple.js --network localhost
```

## Testnet Deployment (Mumbai)
```bash
npx hardhat run scripts/deploy-simple.js --network polygonMumbai
```

## Mainnet Deployment (Polygon)
```bash
npx hardhat run scripts/deploy-simple.js --network polygon
```

## Contract Verification
After deployment, verify your contract on Polygonscan:

1. Get your API key from Polygonscan
2. Add to .env: `POLYGONSCAN_API_KEY=your_api_key`
3. Run verification:
   ```bash
   npx hardhat verify --network polygon DEPLOYED_CONTRACT_ADDRESS
   ```

## Deployment Parameters
The contract is deployed with these parameters:
- **Name**: SalisToken
- **Symbol**: SATO
- **Initial Supply**: 1,000,000 tokens
- **Max Supply**: 10,000,000 tokens
- **Decimals**: 18

## Post-Deployment
1. Verify contract deployment
2. Check initial token distribution
3. Test basic functionality
4. Configure any additional parameters
5. Update frontend configuration

## Security Checklist
- [ ] Verify contract address
- [ ] Check owner address
- [ ] Verify initial supply
- [ ] Test basic transfers
- [ ] Verify blacklist functionality
- [ ] Test pausable features
