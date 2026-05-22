// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import {Script, console} from "forge-std/Script.sol";
import {HederaToken} from "../src/HederaToken.sol";

contract TokenOperationsScript is Script {
    address public constant TOKEN_ADDRESS = 0xD1557C41a7e504C16de843a4ADfBA68FD284E6A3; // Replace with actual address if needed

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("OPERATOR_KEY");
        address deployerAddress = vm.addr(deployerPrivateKey);

        console.log("Deployer address:", deployerAddress);

        // Uncomment below to use existing token:
        // HederaToken token = HederaToken(TOKEN_ADDRESS);

        vm.startBroadcast(deployerPrivateKey);

        HederaToken token = new HederaToken(deployerAddress);

        vm.stopBroadcast();

        console.log("HederaToken deployed to:", address(token));

        uint256 initialBalance = token.balanceOf(deployerAddress);
        console.log("Initial balance of deployer:", initialBalance);

        // Mint more tokens:
        vm.startBroadcast(deployerPrivateKey);
        token.mint(deployerAddress, 500 * 10**token.decimals());
        vm.stopBroadcast();

        uint256 newBalance = token.balanceOf(deployerAddress);
        console.log("Balance after minting:", newBalance);

        console.log("Token name:", token.name());
        console.log("Token symbol:", token.symbol());
        console.log("Token decimals:", token.decimals());
        console.log("Total supply:", token.totalSupply());
    }

    // The other functions can be copy-pasted into a separate script, or just called directly if using script arguments + env.
}
