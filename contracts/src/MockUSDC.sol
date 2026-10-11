// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo-only currency. Not issued by Circle and not backed by dollars.
contract MockUSDC is ERC20 {
    error TestnetOnly();
    error AlreadyClaimed();
    mapping(address => bool) public claimed;

    constructor(address recipient) ERC20("Call My Bluff Mock USDC", "mUSDC") {
        if (block.chainid != 10143) revert TestnetOnly();
        _mint(recipient, 10_000 * 10 ** 6);
        claimed[recipient] = true;
    }

    function decimals() public pure override returns (uint8) { return 6; }

    /// @notice One free 1,000 mUSDC claim per address; demo-only, not Sybil resistant.
    function faucet() external {
        if (block.chainid != 10143) revert TestnetOnly();
        if (claimed[msg.sender]) revert AlreadyClaimed();
        claimed[msg.sender] = true;
        _mint(msg.sender, 1_000 * 10 ** 6);
    }
}
