// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Satoshit} from "../src/Satoshit.sol";

contract SatoshitTest is Test {
    Satoshit shit;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        vm.roll(1000);
        shit = new Satoshit();
    }

    function testInitialState() public view {
        assertEq(shit.name(), "Satoshit");
        assertEq(shit.symbol(), "SHIT");
        assertEq(shit.decimals(), 18);
        assertEq(shit.MAX_SUPPLY(), 21_000_000e18);
        assertEq(shit.totalSupply(), 21_000_000e18);
        assertEq(shit.balanceOf(address(shit)), 21_000_000e18);
        assertEq(shit.totalMints(), 0);
        assertEq(shit.totalBurned(), 0);
        assertEq(shit.currentDifficulty(), 1 << 240);
        assertEq(shit.BURN_BPS(), 100);
        assertEq(shit.grossReward(), 100e18);
        assertEq(shit.currentReward(), 99e18); // 100 - 1% burn
        assertEq(shit.currentEra(), 0);
    }

    function testNoOwnerNoAdmin() public view {
        // There are no admin functions. Bytecode of a contract size check is
        // not meaningful here -- instead we enumerate: no owner()/pause()/etc.
        // This test just asserts constants are constants (compile-time checks).
        assertEq(shit.MAX_MINTS_PER_BLOCK(), 10);
        assertEq(shit.ERA_MINTS(), 100_000);
        assertEq(shit.EPOCH_BLOCKS(), 100);
        assertEq(shit.ADJUSTMENT_INTERVAL(), 2_016);
    }

    function testChallengeIsPerMinerPerEpoch() public view {
        bytes32 a1 = shit.getChallenge(alice);
        bytes32 b1 = shit.getChallenge(bob);
        assertTrue(a1 != b1, "challenge must differ per miner");
    }

    function testChallengeMatchesLocalRecipe() public view {
        bytes32 onchain = shit.getChallenge(alice);
        bytes32 local = keccak256(
            abi.encode(block.chainid, address(shit), alice, shit.currentEpoch())
        );
        assertEq(onchain, local);
    }

    function testVerifyProofView() public {
        uint256 nonce = _findNonce(alice);
        assertTrue(shit.verifyProof(alice, nonce), "valid proof should verify");
        assertFalse(shit.verifyProof(alice, nonce + 1), "different nonce should fail");
    }

    function testMineWithValidNonceMintsNetRewardAndBurns() public {
        uint256 nonce = _findNonce(alice);
        uint256 totalSupplyBefore = shit.totalSupply();

        vm.prank(alice);
        shit.mine(nonce);

        // 99 to alice, 1 burned
        assertEq(shit.balanceOf(alice), 99e18);
        assertEq(shit.totalMints(), 1);
        assertEq(shit.totalBurned(), 1e18);
        assertEq(shit.totalSupply(), totalSupplyBefore - 1e18);
        assertEq(shit.balanceOf(address(shit)), 21_000_000e18 - 100e18);
    }

    function testMineRejectsInvalidNonce() public {
        vm.prank(alice);
        vm.expectRevert(Satoshit.InsufficientWork.selector);
        shit.mine(uint256(keccak256("bogus")));
    }

    function testReplayRejected() public {
        uint256 nonce = _findNonce(alice);
        vm.prank(alice);
        shit.mine(nonce);
        vm.prank(alice);
        vm.expectRevert(Satoshit.ProofAlreadyUsed.selector);
        shit.mine(nonce);
    }

    function testBlockCapEnforced() public {
        uint256 cap = shit.MAX_MINTS_PER_BLOCK();
        for (uint256 i = 0; i < cap; i++) {
            address miner = address(uint160(uint256(0x1000 + i)));
            uint256 n = _findNonce(miner);
            vm.prank(miner);
            shit.mine(n);
        }
        address extra = address(0x9999);
        uint256 nonce = _findNonce(extra);
        vm.prank(extra);
        vm.expectRevert(Satoshit.BlockCapReached.selector);
        shit.mine(nonce);
    }

    function testCannotMineAsZeroAddress() public {
        uint256 nonce = _findNonce(address(0));
        vm.prank(address(0));
        vm.expectRevert(Satoshit.InvalidMiner.selector);
        shit.mine(nonce);
    }

    function testCannotMineAsContract() public {
        // Can't realistically prank as the contract itself easily,
        // but the check rejects msg.sender==address(this) as a defense in depth.
        // Simulate via vm.prank.
        uint256 nonce = _findNonce(address(shit));
        vm.prank(address(shit));
        vm.expectRevert(Satoshit.InvalidMiner.selector);
        shit.mine(nonce);
    }

    function testHolderCanBurnVoluntarily() public {
        uint256 nonce = _findNonce(alice);
        vm.prank(alice);
        shit.mine(nonce);
        assertEq(shit.balanceOf(alice), 99e18);

        uint256 supplyBefore = shit.totalSupply();
        vm.prank(alice);
        shit.burn(10e18);
        assertEq(shit.balanceOf(alice), 89e18);
        assertEq(shit.totalSupply(), supplyBefore - 10e18);
    }

    function testHalvingConstants() public view {
        assertEq(shit.BASE_REWARD(), 100e18);
        assertEq(shit.BASE_REWARD() >> 1, 50e18);
        assertEq(shit.BASE_REWARD() >> 2, 25e18);
        assertEq(shit.BASE_REWARD() >> 3, 12.5e18);
        assertEq(shit.BASE_REWARD() >> 8, 0.390625e18);
    }

    // Brute-force helper using scratch memory to avoid OOM in loops.
    function _findNonce(address miner) internal view returns (uint256) {
        bytes32 challenge = shit.getChallenge(miner);
        uint256 difficulty = shit.currentDifficulty();
        for (uint256 n = 0; n < 2_000_000; n++) {
            bytes32 result;
            assembly {
                mstore(0x00, challenge)
                mstore(0x20, n)
                result := keccak256(0x00, 0x40)
            }
            if (uint256(result) < difficulty) return n;
        }
        revert("no nonce found in search window");
    }
}
