// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {Satoshit} from "../src/Satoshit.sol";

contract Deploy is Script {
    function run() external {
        uint256 pk = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(pk);
        Satoshit shit = new Satoshit();
        vm.stopBroadcast();

        console.log("Satoshit deployed at:", address(shit));
        console.log("MAX_SUPPLY:      ", shit.MAX_SUPPLY());
        console.log("BASE_REWARD:     ", shit.BASE_REWARD());
        console.log("currentDifficulty:", shit.currentDifficulty());
        console.log("GENESIS_BLOCK:   ", shit.GENESIS_BLOCK());
    }
}
