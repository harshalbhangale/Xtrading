// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Demo-only PEPE lookalike for showing Xtrading's unknown-contract flag.
///         It deploys only on Monad testnet, so it can never carry real value.
///         Nansen indexes mainnets only, so it never knows this token: exactly the
///         pattern of a shilled contract address that is not the real PEPE.
contract FakePepe is ERC20 {
    error TestnetOnly();

    constructor() ERC20("Pepe", "PEPE") {
        if (block.chainid != 10143) revert TestnetOnly();
        // Concentrated supply, the way a rug is usually set up.
        _mint(msg.sender, 420_690_000_000 ether);
    }
}
