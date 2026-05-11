// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/*
    ███████╗ █████╗ ████████╗ ██████╗ ███████╗██╗  ██╗██╗████████╗
    ██╔════╝██╔══██╗╚══██╔══╝██╔═══██╗██╔════╝██║  ██║██║╚══██╔══╝
    ███████╗███████║   ██║   ██║   ██║███████╗███████║██║   ██║
    ╚════██║██╔══██║   ██║   ██║   ██║╚════██║██╔══██║██║   ██║
    ███████║██║  ██║   ██║   ╚██████╔╝███████║██║  ██║██║   ██║
    ╚══════╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝   ╚═╝

    Fair-launch, browser-mined ERC20 on Base. v2 — security hardened.
    21 million hard cap. Bitcoin-style halving. keccak256 proof-of-work.
    Deflationary: 1% of every reward is burned (reduces totalSupply).

    Guarantees:
      - No owner, admin, proxy, or upgrade path.
      - No pause, blacklist, whitelist, or transfer fee.
      - No premint (supply is escrowed to the contract, only mine() transfers out).
      - No backdoor — mine() is the only issuance path and it's PoW-gated.
      - ReentrancyGuard on mine() (defense in depth; no external calls anyway).
      - User (holder) can voluntarily burn via ERC20Burnable.
*/
contract Satoshit is ERC20, ERC20Burnable, ReentrancyGuard {
    // ---------- Constants (locked at compile time) ----------

    /// @notice Absolute supply ceiling at genesis. totalSupply can only decrease from here (via burn).
    uint256 public constant MAX_SUPPLY = 21_000_000e18;

    /// @notice Initial reward per successful mine() call (before burn fee).
    uint256 public constant BASE_REWARD = 100e18;

    /// @notice Mints per era. Reward halves every era (Bitcoin-style).
    uint256 public constant ERA_MINTS = 100_000;

    /// @notice Blocks per epoch. Challenge rotates each epoch.
    uint256 public constant EPOCH_BLOCKS = 100;

    /// @notice Retarget interval in mints.
    uint256 public constant ADJUSTMENT_INTERVAL = 2_016;

    /// @notice Target number of blocks between successful mints.
    uint256 public constant TARGET_BLOCKS_PER_MINT = 5;

    /// @notice Anti-spam: maximum successful mines per block.
    uint256 public constant MAX_MINTS_PER_BLOCK = 10;

    /// @notice Maximum era. After era 63, reward is 0 (eras stop producing supply).
    uint256 public constant MAX_ERA = 64;

    /// @notice Burn fee in basis points. 100 = 1% of every reward is burned.
    ///         Immutable. Cannot be changed after deploy.
    uint256 public constant BURN_BPS = 100;

    /// @notice Genesis block of this contract.
    uint256 public immutable GENESIS_BLOCK;

    // ---------- Mutable mining state (no admin access) ----------

    uint256 public totalMints;
    uint256 public currentDifficulty;
    uint256 public lastAdjustmentMint;
    uint256 public lastAdjustmentBlock;
    uint256 public totalBurned;

    /// @notice Mines executed in the given block number (anti-spam).
    mapping(uint256 => uint256) public mintsInBlock;

    /// @notice Replay guard: proofs keyed by (miner, nonce, epoch).
    mapping(bytes32 => bool) public usedProofs;

    // ---------- Errors ----------

    error SupplyExhausted();
    error BlockCapReached();
    error InsufficientWork();
    error ProofAlreadyUsed();
    error InvalidMiner();

    // ---------- Events ----------

    event Mined(
        address indexed miner,
        uint256 nonce,
        uint256 rewardPaid,
        uint256 burned,
        uint256 era,
        uint256 epoch
    );
    event DifficultyAdjusted(uint256 fromDiff, uint256 toDiff, uint256 blocksTaken);
    event Halving(uint256 indexed era, uint256 newReward);

    // ---------- Constructor ----------

    constructor() ERC20("Satoshit", "SHIT") {
        GENESIS_BLOCK = block.number;
        lastAdjustmentBlock = block.number;
        // Initial difficulty 2^240 -- ~2^16 expected attempts per mint on a CPU.
        currentDifficulty = 1 << 240;

        // All supply escrowed to the contract itself. mine() is the only
        // function that can move it out. ERC20Burnable lets holders reduce it.
        _mint(address(this), MAX_SUPPLY);
    }

    // ---------- Views ----------

    function currentEpoch() public view returns (uint256) {
        return block.number / EPOCH_BLOCKS;
    }

    function currentEra() public view returns (uint256) {
        return totalMints / ERA_MINTS;
    }

    /// @notice Gross reward this epoch (before burn fee).
    function grossReward() public view returns (uint256) {
        uint256 era = currentEra();
        return era < MAX_ERA ? BASE_REWARD >> era : 0;
    }

    /// @notice Net reward miner actually receives (after burn fee).
    function currentReward() public view returns (uint256) {
        uint256 gross = grossReward();
        return gross - (gross * BURN_BPS) / 10_000;
    }

    function minedSupply() external view returns (uint256) {
        // totalSupply() already reflects burns (ERC20Burnable updates it).
        return MAX_SUPPLY - balanceOf(address(this)) - totalBurned;
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

    /// @notice Verify a (miner, nonce) pair client-side without sending a tx.
    function verifyProof(address miner, uint256 nonce) external view returns (bool) {
        bytes32 challenge = _challenge(miner);
        bytes32 result = keccak256(abi.encode(challenge, nonce));
        return uint256(result) < currentDifficulty;
    }

    // ---------- Core mining ----------

    function mine(uint256 nonce) external nonReentrant {
        // Must not be the contract itself — prevents internal self-reward loops.
        if (msg.sender == address(this) || msg.sender == address(0)) revert InvalidMiner();

        uint256 available = balanceOf(address(this));
        if (available == 0) revert SupplyExhausted();

        if (mintsInBlock[block.number] >= MAX_MINTS_PER_BLOCK) revert BlockCapReached();

        // PoW check
        bytes32 challenge = _challenge(msg.sender);
        bytes32 result = keccak256(abi.encode(challenge, nonce));
        if (uint256(result) >= currentDifficulty) revert InsufficientWork();

        // Replay guard keyed on (miner, nonce, epoch).
        bytes32 proofKey = keccak256(abi.encode(msg.sender, nonce, currentEpoch()));
        if (usedProofs[proofKey]) revert ProofAlreadyUsed();
        usedProofs[proofKey] = true;

        // Effects
        unchecked {
            mintsInBlock[block.number] += 1;
            totalMints += 1;
        }

        if (totalMints - lastAdjustmentMint >= ADJUSTMENT_INTERVAL) {
            _adjustDifficulty();
        }

        uint256 era = currentEra();
        uint256 gross = era < MAX_ERA ? BASE_REWARD >> era : 0;
        if (gross == 0) revert SupplyExhausted();
        if (gross > available) gross = available;

        uint256 burn = (gross * BURN_BPS) / 10_000;
        uint256 net = gross - burn;

        // Interactions (last)
        if (burn > 0) {
            _burn(address(this), burn);
            unchecked { totalBurned += burn; }
        }
        if (net > 0) {
            _transfer(address(this), msg.sender, net);
        }

        if (era > 0 && totalMints % ERA_MINTS == 0) {
            emit Halving(era, gross);
        }
        emit Mined(msg.sender, nonce, net, burn, era, currentEpoch());
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
            nextDiff = oldDiff / 4;
        } else {
            nextDiff = (oldDiff * blocksTaken) / target;
        }

        // Bitcoin-style ×¼ … ×4 clamp per retarget.
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
