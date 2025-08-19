# Testing Guide - SalisToken

## Test Coverage
The test suite covers all major functionality of the SalisToken contract.

## Running Tests
```bash
# Run all tests
npm test

# Run specific test file
npx hardhat test test/SalisToken.test.js

# Run with gas reporting
REPORT_GAS=true npm test

# Run with coverage
npx hardhat coverage
```

## Test Categories

### 1. Basic ERC-20 Functionality
- Token transfers
- Balance tracking
- Approval mechanism
- TransferFrom functionality

### 2. Supply Management
- Initial supply verification
- Max supply enforcement
- Minting functionality
- Supply calculations

### 3. Blacklist Functionality
- Blacklist addition/removal
- Transfer prevention for blacklisted addresses
- Blacklist status checking
- Batch blacklist operations

### 4. Token Locking
- Token distribution with locks
- Lock time enforcement
- Transfer prevention during lock
- Automatic lock release

### 5. Pausable Features
- Transfer pausing
- Minting pausing
- Resume functionality
- Pause state verification

### 6. Access Control
- Owner-only function protection
- Unauthorized access prevention
- Role verification

### 7. NDA Compliance
- NDA hash verification
- Compliance checking
- Hash generation

## Test Structure
```
test/
├── SalisToken.test.js    # Main contract tests
└── Blacklist.test.js     # Blacklist-specific tests
```

## Key Test Scenarios

### Transfer Tests
- Normal transfers between accounts
- Transfers to/from blacklisted addresses
- Transfers with locked tokens
- Transfers when contract is paused

### Minting Tests
- Owner minting within limits
- Minting beyond max supply
- Minting when paused
- Unauthorized minting attempts

### Blacklist Tests
- Adding addresses to blacklist
- Removing addresses from blacklist
- Batch blacklist operations
- Blacklist enforcement in transfers

### Lock Tests
- Distributing tokens with locks
- Transfer prevention during lock
- Lock expiration verification
- Lock time calculations

## Assertions Used
- `expect().to.equal()` - Value equality
- `expect().to.be.reverted()` - Revert checking
- `expect().to.emit()` - Event emission
- `expect().to.changeEtherBalance()` - Balance changes

## Test Data
Tests use Hardhat's default accounts:
- Account 0: Owner/Deployer
- Account 1-9: Test users

## Continuous Integration
Tests are configured to run in CI/CD pipelines with:
- Automated testing on pull requests
- Coverage reporting
- Gas usage tracking
