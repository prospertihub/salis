# SalisToken Smart Contract - Audit Package

## Overview
SalisToken is an ERC-20 compatible smart contract with advanced features including blacklist functionality, token locking, and NDA compliance verification.

## Features
- **Standard ERC-20**: Full ERC-20 token functionality
- **Supply Management**: Configurable max supply with minting limits
- **Blacklist System**: Address-based blacklisting with transfer prevention
- **Token Locking**: Time-based token locking with automatic release
- **Pausable Operations**: Emergency pause functionality for transfers and minting
- **NDA Compliance**: Built-in NDA hash verification system
- **Access Control**: Owner-based access control for administrative functions

## Quick Start

### Installation
```bash
npm install
```

### Compilation
```bash
npx hardhat compile
```

### Testing
```bash
npm test
```

### Local Deployment
```bash
npx hardhat node
npx hardhat run scripts/deploy-simple.js --network localhost
```

## Documentation
- [Audit Guide](AUDIT_GUIDE.md) - Comprehensive audit information
- [Security Analysis](SECURITY.md) - Security features and considerations
- [Deployment Guide](DEPLOYMENT.md) - Deployment instructions
- [Testing Guide](TESTING.md) - Testing procedures and coverage

## Contract Details
- **Contract**: `contracts/SalisToken.sol`
- **Standard**: ERC-20
- **Solidity Version**: 0.8.20
- **License**: MIT

## Security
This contract includes multiple security features:
- Reentrancy protection
- Access control
- Supply limits
- Blacklist enforcement
- Pausable functionality

## Testing
The contract includes comprehensive tests covering:
- Basic ERC-20 functionality
- Supply management
- Blacklist operations
- Token locking
- Pausable features
- Access control

## License
MIT License - see LICENSE file for details.

## Support
For questions or issues, please refer to the documentation or create an issue in the repository.
