// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/*
    ███████╗ █████╗ ████████╗ ██████╗ ███████╗██╗  ██╗██╗████████╗
    ██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔════╝██║  ██║██║╚══██╔══╝
    ███████╗███████║   ██║   ██║   ██║███████╗███████║██║   ██║
    ╚════██║██╔══██║   ██║   ██║   ██║╚════██║██╔══██║██║   ██║
    ███████║██║  ██║   ██║   ╚██████╔╝███████║██║  ██║██║   ██║
    ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝

    Fair-launch, browser-mined ERC20 on Base.
    21 million hard cap. Bitcoin-style halving. keccak256 proof-of-work.

    No owner. No admin. No pause. No blacklist. No fee logic.
    No presale. No premint. No VC. No team allocation.
    The only way SHIT enters circulation is via mine().
*/
contract Satoshit is ERC20 {
    // ---------- Constants (locked at compile time) ----------

    /// @notice Absolute supply ceiling. Cannot be exceeded.
    uint256 public constant MAX_SUPPLY = 21_000_000e18;

    /// @notice Initial reward per successful mine() call.
    uint256 public constant BASE_REWARD = 100e18;

    /// @notice Mints per era. Reward halves every era.
    uint256 public constant ERA_MINTS = 100_000;

    /// @notice Blocks per epoch. Challenge rotates each epoch.
    uint256 public constant EPOCH_BLOCKS = 100;

    /// @notice Retarget interval in mints (Bitcoin-style).
    uint256 public constant ADJUSTMENT_INTERVAL = 2_016;

    /// @notice Target number of blocks between successful mints.
    uint256 public constant TARGET_BLOCKS_PER_MINT = 5;

    /// @notice Anti-spam: maximum successful mines per block.
    uint256 public constant MAX_MINTS_PER_BLOCK = 10;

    /// @notice Genesis block of this contract.
    uint256 public immutable GENESIS_BLOCK;

    // ---------- Mutable mining state (no admin access) ----------

    /// @notice Total number of successful mine() calls.
    uint256 public totalMints;

    /// @notice Current PoW difficulty (proof < difficulty).
    uint256 public currentDifficulty;

    /// @notice Mint count at last retarget.
    uint256 public lastAdjustmentMint;

    /// @notice Block number at last retarget.
    uint256 public lastAdjustmentBlock;

    /// @notice Mines executed in the given block number.
    mapping(uint256 => uint256) public mintsInBlock;

    /// @notice Replay guard: proofs keyed by (miner, nonce, epoch).
    mapping(bytes32 => bool) public usedProofs;

    // ---------- Errors ----------

    error SupplyExhausted();
    error BlockCapReached();
    error InsufficientWork();
    error ProofAlreadyUsed();

    // ---------- Events ----------

    event Mined(address indexed miner, uint256 nonce, uint256 reward, uint256 era, uint256 epoch);
    event DifficultyAdjusted(uint256 fromDiff, uint256 toDiff, uint256 blocksTaken);
    event Halving(uint256 era, uint256 newReward);

    // ---------- Constructor ----------

    constructor() ERC20("Satoshit", "SHIT") {
        GENESIS_BLOCK = block.number;
        lastAdjustmentBlock = block.number;
        // Initial difficulty: 2^240. About 2^16 expected attempts per mint
        // for a single CPU, keeps first era accessible. Auto-retargets from here.
        currentDifficulty = 1 << 240;

        // Mint the full supply to the contract itself. mine() transfers out.
        // No other path to issuance. After 21M is mined, mine() reverts.
        _mint(address(this), MAX_SUPPLY);
    }

    // ---------- Views ----------

    function currentEpoch() public view returns (uint256) {
        return block.number / EPOCH_BLOCKS;
    }

    function currentEra() public view returns (uint256) {
        return totalMints / ERA_MINTS;
    }

    function currentReward() public view returns (uint256) {
        uint256 era = currentEra();
        return era < 64 ? BASE_REWARD >> era : 0;
    }

    function minedSupply() external view returns (uint256) {
        return MAX_SUPPLY - balanceOf(address(this));
    }

    function remainingSupply() external view returns (uint256) {
        return balanceOf(address(this));
    }

    function blocksUntilNextEpoch() external view returns (uint256) {
        uint256 left = EPOCH_BLOCKS - (block.number % EPOCH_BLOCKS);
        return left == EPOCH_BLOCKS ? 0 : left;
    }

    function mintsUntilRetarget() external view returns (uint256) {
        uint256 progress = totalMints - lastAdjustmentMint;
        return progress >= ADJUSTMENT_INTERVAL ? 0 : ADJUSTMENT_INTERVAL - progress;
    }

    function getChallenge(address miner) external view returns (bytes32) {
        return _challenge(miner);
    }

    // ---------- Core mining ----------

    function mine(uint256 nonce) external {
        if (balanceOf(address(this)) == 0) revert SupplyExhausted();
        if (mintsInBlock[block.number] >= MAX_MINTS_PER_BLOCK) revert BlockCapReached();

        bytes32 challenge = _challenge(msg.sender);
        bytes32 result = keccak256(abi.encode(challenge, nonce));
        if (uint256(result) >= currentDifficulty) revert InsufficientWork();

        bytes32 proofKey = keccak256(abi.encode(msg.sender, nonce, currentEpoch()));
        if (usedProofs[proofKey]) revert ProofAlreadyUsed();
        usedProofs[proofKey] = true;

        mintsInBlock[block.number]++;
        totalMints++;

        if (totalMints - lastAdjustmentMint >= ADJUSTMENT_INTERVAL) {
            _adjustDifficulty();
        }

        uint256 era = currentEra();
        uint256 reward = era < 64 ? BASE_REWARD >> era : 0;

        uint256 available = balanceOf(address(this));
        if (reward > available) reward = available;
        if (reward == 0) revert SupplyExhausted();

        _transfer(address(this), msg.sender, reward);

        if (era > 0 && totalMints % ERA_MINTS == 0) {
            emit Halving(era, reward);
        }
        emit Mined(msg.sender, nonce, reward, era, currentEpoch());
    }

    // ---------- Internal ----------

    function _challenge(address miner) internal view returns (bytes32) {
        return keccak256(
            abi.encode(block.chainid, address(this), miner, currentEpoch())
        );
    }

    function _adjustDifficulty() internal {
        uint256 blocksTaken = block.number - lastAdjustmentBlock;
        uint256 target = ADJUSTMENT_INTERVAL * TARGET_BLOCKS_PER_MINT;
        uint256 oldDiff = currentDifficulty;

        uint256 nextDiff;
        if (blocksTaken == 0) {
            // Mines were instantaneous — quarter the difficulty.
            nextDiff = oldDiff / 4;
        } else {
            // next = old * (blocksTaken / target)
            // If blocksTaken > target -> easier; blocksTaken < target -> harder
            nextDiff = (oldDiff * blocksTaken) / target;
        }

        // Clamp change to [÷4, ×4] like Bitcoin
        uint256 floor_ = oldDiff / 4;
        uint256 ceil_ = oldDiff * 4;
        if (nextDiff < floor_) nextDiff = floor_;
        if (nextDiff > ceil_) nextDiff = ceil_;
        if (nextDiff == 0) nextDiff = 1;

        currentDifficulty = nextDiff;
        lastAdjustmentMint = totalMints;
        lastAdjustmentBlock = block.number;

        emit DifficultyAdjusted(oldDiff, nextDiff, blocksTaken);
    }
}
