// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title SalisToken
 * @dev Enhanced ERC-20 token with time-locked balances and advanced security features
 */
contract SalisToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    // Events
    event TokensMinted(address indexed to, uint256 amount);
    event TokensBurned(address indexed from, uint256 amount);
    event BlacklistUpdated(address indexed account, bool isBlacklisted);
    event BlacklistBatchUpdated(address[] accounts, bool isBlacklisted);
    event MaxSupplyUpdated(uint256 oldMaxSupply, uint256 newMaxSupply);
    event MintingPaused(address indexed by);
    event MintingResumed(address indexed by);
    event Locked(address indexed to, uint256 amount, uint64 releaseTime);
    event LockExtended(address indexed to, uint64 oldRelease, uint64 newRelease);
    event Unlocked(address indexed account, uint256 amount);

    // State variables
    uint256 public maxSupply;
    mapping(address => bool) public isBlacklisted;
    bool public mintingPaused;
    uint256 public blacklistedCount;
    bool public maxSupplySet = false;

    // Immutable NDA hash - set once during deployment, never changeable
    bytes32 public immutable ndaHash;

    // Time-lock variables
    mapping(address => uint256) public lockedBalances;
    mapping(address => uint64) public lockReleaseTimes;

    // Constants
    uint256 private constant SECONDS_PER_DAY = 86400;

    // Modifiers
    modifier notBlacklisted(address account) { require(!isBlacklisted[account], "SalisToken: Account is blacklisted"); _; }
    modifier mintingNotPaused() { require(!mintingPaused, "SalisToken: Minting is paused"); _; }

    /**
     * @dev Constructor
     * @param _name Token name
     * @param _symbol Token symbol
     * @param _initialSupply Initial token supply
     * @param _maxSupply Maximum token supply
     * @param _ndaHash NDA hash code for legal compliance (immutable)
     */
    constructor(string memory _name, string memory _symbol, uint256 _initialSupply, uint256 _maxSupply, bytes32 _ndaHash)
        ERC20(_name, _symbol) Ownable(msg.sender) {
        require(_maxSupply >= _initialSupply, "SalisToken: Max supply must be >= initial supply");
        require(_ndaHash != bytes32(0), "SalisToken: NDA hash cannot be zero");
        maxSupply = _maxSupply;
        if (_maxSupply > 0) { maxSupplySet = true; }
        ndaHash = _ndaHash;
        if (_initialSupply > 0) { _mint(msg.sender, _initialSupply); }
    }

    function mint(address to, uint256 amount) external onlyOwner mintingNotPaused notBlacklisted(to) nonReentrant {
        require(to != address(0), "SalisToken: Cannot mint to zero address");
        require(amount > 0, "SalisToken: Amount must be greater than 0");
        require(totalSupply() + amount <= maxSupply, "SalisToken: Would exceed max supply");
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    function burn(uint256 amount) external notBlacklisted(msg.sender) nonReentrant {
        require(amount > 0, "SalisToken: Amount must be greater than 0");
        require(this.transferableBalanceOf(msg.sender) >= amount, "SalisToken: Insufficient transferable balance");
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    function burnFrom(address from, uint256 amount) external onlyOwner notBlacklisted(from) nonReentrant {
        require(amount > 0, "SalisToken: Amount must be greater than 0");
        require(this.transferableBalanceOf(from) >= amount, "SalisToken: Insufficient transferable balance");
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    function transfer(address to, uint256 amount) public override whenNotPaused notBlacklisted(msg.sender) notBlacklisted(to) returns (bool) {
        require(this.transferableBalanceOf(msg.sender) >= amount, "SalisToken: Insufficient transferable balance");
        return super.transfer(to, amount);
    }

    function transferFrom(address from, address to, uint256 amount) public override whenNotPaused notBlacklisted(from) notBlacklisted(to) returns (bool) {
        require(this.transferableBalanceOf(from) >= amount, "SalisToken: Insufficient transferable balance");
        return super.transferFrom(from, to, amount);
    }

    function approve(address spender, uint256 amount) public override notBlacklisted(msg.sender) notBlacklisted(spender) returns (bool) {
        return super.approve(spender, amount);
    }

    function distributeLocked(address to, uint256 amount, uint64 daysLock) external onlyOwner notBlacklisted(to) nonReentrant {
        require(to != address(0), "SalisToken: Cannot lock to zero address");
        require(amount > 0, "SalisToken: Amount must be greater than 0");
        require(daysLock > 0, "SalisToken: Lock period must be greater than 0");
        require(balanceOf(msg.sender) >= amount, "SalisToken: Insufficient balance to distribute");
        uint64 releaseTime = uint64(uint256(block.timestamp) + (daysLock * SECONDS_PER_DAY));
        _transfer(msg.sender, to, amount);
        uint64 currentReleaseTime = lockReleaseTimes[to];
        uint256 currentLockedAmount = lockedBalances[to];
        if (currentLockedAmount > 0) {
            if (releaseTime > currentReleaseTime) {
                emit LockExtended(to, currentReleaseTime, releaseTime);
                lockReleaseTimes[to] = releaseTime;
            }
        } else {
            lockReleaseTimes[to] = releaseTime;
        }
        lockedBalances[to] = currentLockedAmount + amount;
        emit Locked(to, amount, releaseTime);
    }

    function lockedBalanceOf(address account) external view returns (uint256) {
        uint256 lockedAmount = lockedBalances[account];
        uint64 releaseTime = lockReleaseTimes[account];
        if (lockedAmount > 0 && block.timestamp >= releaseTime) { return 0; }
        return lockedAmount;
    }

    function transferableBalanceOf(address account) external view returns (uint256) {
        uint256 totalBalance = balanceOf(account);
        uint256 lockedAmount = lockedBalances[account];
        uint64 releaseTime = lockReleaseTimes[account];
        if (lockedAmount > 0 && block.timestamp >= releaseTime) { return totalBalance; }
        return totalBalance - lockedAmount;
    }

    function lockReleaseTimeOf(address account) external view returns (uint64) { return lockReleaseTimes[account]; }

    function unlockExpired(address account) external nonReentrant {
        uint256 lockedAmount = lockedBalances[account];
        uint64 releaseTime = lockReleaseTimes[account];
        require(lockedAmount > 0, "SalisToken: No locked tokens");
        require(block.timestamp >= releaseTime, "SalisToken: Lock has not expired");
        uint256 unlockedAmount = lockedAmount;
        lockedBalances[account] = 0;
        lockReleaseTimes[account] = 0;
        emit Unlocked(account, unlockedAmount);
    }

    function _checkAndUnlockExpired(address account) internal returns (bool) {
        uint256 lockedAmount = lockedBalances[account];
        uint64 releaseTime = lockReleaseTimes[account];
        if (lockedAmount > 0 && block.timestamp >= releaseTime) {
            lockedBalances[account] = 0;
            lockReleaseTimes[account] = 0;
            emit Unlocked(account, lockedAmount);
            return true;
        }
        return false;
    }

    function setBlacklist(address account, bool blacklisted) external onlyOwner {
        require(account != address(0), "SalisToken: Cannot blacklist zero address");
        bool wasBlacklisted = isBlacklisted[account];
        isBlacklisted[account] = blacklisted;
        if (blacklisted && !wasBlacklisted) { blacklistedCount++; }
        else if (!blacklisted && wasBlacklisted) { blacklistedCount--; }
        emit BlacklistUpdated(account, blacklisted);
    }

    function setBlacklistBatch(address[] calldata accounts, bool blacklisted) external onlyOwner {
        require(accounts.length > 0, "SalisToken: Empty accounts array");
        require(accounts.length <= 100, "SalisToken: Too many accounts (max 100)");
        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(account != address(0), "SalisToken: Cannot blacklist zero address");
            bool wasBlacklisted = isBlacklisted[account];
            isBlacklisted[account] = blacklisted;
            if (blacklisted && !wasBlacklisted) { blacklistedCount++; }
            else if (!blacklisted && wasBlacklisted) { blacklistedCount--; }
        }
        emit BlacklistBatchUpdated(accounts, blacklisted);
    }

    function clearAllBlacklist() external onlyOwner returns (uint256) {
        uint256 cleared = blacklistedCount;
        blacklistedCount = 0;
        emit BlacklistBatchUpdated(new address[](0), false);
        return cleared;
    }

    function setMaxSupply(uint256 _maxSupply) external onlyOwner {
        require(!maxSupplySet, "SalisToken: Max supply can only be set once");
        require(_maxSupply >= totalSupply(), "SalisToken: Max supply must be >= current supply");
        uint256 oldMaxSupply = maxSupply;
        maxSupply = _maxSupply;
        maxSupplySet = true;
        emit MaxSupplyUpdated(oldMaxSupply, _maxSupply);
    }

    function pauseMinting() external onlyOwner { mintingPaused = true; emit MintingPaused(msg.sender); }
    function resumeMinting() external onlyOwner { mintingPaused = false; emit MintingResumed(msg.sender); }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function getRemainingMintableSupply() external view returns (uint256) { return maxSupply - totalSupply(); }
    function isAddressBlacklisted(address account) external view returns (bool) { return isBlacklisted[account]; }
    function getBlacklistStats() external view returns (uint256 totalBlacklisted) { return blacklistedCount; }

    function areAddressesBlacklisted(address[] calldata accounts) external view returns (bool[] memory) {
        bool[] memory results = new bool[](accounts.length);
        for (uint256 i = 0; i < accounts.length; i++) { results[i] = isBlacklisted[accounts[i]]; }
        return results;
    }

    function getTokenInfo() external view returns (
        string memory name,
        string memory symbol,
        uint8 decimals,
        uint256 totalSupply,
        uint256 maxSupplyValue,
        uint256 remainingMintable,
        bytes32 ndaHashValue
    ) {
        return (
            this.name(),
            this.symbol(),
            this.decimals(),
            this.totalSupply(),
            maxSupply,
            maxSupply - this.totalSupply(),
            ndaHash
        );
    }

    function verifyNDACompliance(bytes32 providedHash) external view returns (bool) { return ndaHash == providedHash; }
    function getNDAHash() external view returns (bytes32) { return ndaHash; }

    function getBalanceInfo(address account) external view returns (
        uint256 totalBalance,
        uint256 lockedBalance,
        uint256 transferableBalance,
        uint64 lockReleaseTime
    ) {
        totalBalance = balanceOf(account);
        lockedBalance = this.lockedBalanceOf(account);
        transferableBalance = this.transferableBalanceOf(account);
        lockReleaseTime = lockReleaseTimes[account];
    }
}
