# SalisToken Smart Contract Audit Guide

## Overview
This document provides comprehensive information for auditing the SalisToken smart contract.

## Contract Details
- **Contract Name**: SalisToken
- **Standard**: ERC-20 with additional features
- **License**: MIT
- **Solidity Version**: 0.8.20

## Key Features
1. **Standard ERC-20 Functionality**
   - Transfer tokens between addresses
   - Approve and transferFrom functionality
   - Balance tracking

2. **Advanced Features**
   - Minting with supply limits
   - Blacklist functionality
   - Token locking with time-based release
   - Pausable transfers and minting
   - NDA compliance verification

3. **Security Features**
   - Access control (owner-only functions)
   - Reentrancy protection
   - Supply cap enforcement
   - Blacklist enforcement

## Audit Focus Areas

### 1. Access Control
- Verify owner-only functions are properly protected
- Check for proper role management
- Ensure no unauthorized minting or burning

### 2. Supply Management
- Verify max supply enforcement
- Check minting limits and remaining supply calculations
- Ensure no supply overflow

### 3. Blacklist Functionality
- Verify blacklist enforcement in transfers
- Check blacklist status updates
- Ensure proper access control for blacklist management

### 4. Token Locking
- Verify lock time calculations
- Check lock enforcement in transfers
- Ensure proper lock release mechanisms

### 5. NDA Compliance
- Verify NDA hash verification
- Check compliance enforcement
- Ensure proper hash generation

## Testing
Run the test suite to verify functionality:
```bash
npm test
```

## Deployment
See DEPLOYMENT.md for deployment instructions.

## Security Considerations
See SECURITY.md for detailed security analysis.
