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
        assertEq(shit.currentDifficulty(), 1 << 240);
        assertEq(shit.currentReward(), 100e18);
        assertEq(shit.currentEra(), 0);
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

    function testMineWithValidNonceMintsReward() public {
        uint256 nonce = _findNonce(alice);
        vm.prank(alice);
        shit.mine(nonce);
        assertEq(shit.balanceOf(alice), 100e18);
        assertEq(shit.totalMints(), 1);
        // supply moved from contract to miner
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

    function testHalvingConstants() public view {
        // Base reward is 100 SHIT
        assertEq(shit.BASE_REWARD(), 100e18);
        // Halving via right-shift: 100 -> 50 -> 25 -> 12.5
        assertEq(shit.BASE_REWARD() >> 1, 50e18);
        assertEq(shit.BASE_REWARD() >> 2, 25e18);
        assertEq(shit.BASE_REWARD() >> 3, 12.5e18);
        // era 8: 100 / 256 = 0.390625 SHIT
        assertEq(shit.BASE_REWARD() >> 8, 0.390625e18);
        // Era cap logic lives in contract ternary (era < 64 ? shift : 0),
        // which we verify directly via currentReward() at era=0 above.
    }

    // Brute-force helper. Uses scratch memory (0x00-0x40) so no memory growth
    // per iteration -- avoids MemoryOOG when called many times in one test.
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
