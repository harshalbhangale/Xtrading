// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Refundable creator deposits. X identity and reputation are separate off-chain proofs.
/// @dev Choose a conventional, non-rebasing ERC20; minimumStake is token units, not an oracle USD value.
contract CreatorStake is ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;
    uint256 public immutable minimumStake;
    uint256 public immutable withdrawalDelay;
    mapping(address => uint256) public balanceOf;
    mapping(address => uint256) public withdrawableAt;

    error InvalidConfiguration();
    error InvalidAmount();
    error WithdrawalPending();
    error NoStake();
    error NoWithdrawal();
    error CooldownActive();
    error UnsupportedToken();

    // Full snapshots allow deterministic, idempotent indexer projections.
    event StakeUpdated(address indexed wallet, uint256 balance, uint256 withdrawableAt);

    constructor(IERC20 token_, uint256 minimumStake_, uint256 withdrawalDelay_) {
        if (address(token_).code.length == 0 || minimumStake_ == 0 || withdrawalDelay_ == 0) {
            revert InvalidConfiguration();
        }
        token = token_;
        minimumStake = minimumStake_;
        withdrawalDelay = withdrawalDelay_;
    }

    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        if (withdrawableAt[msg.sender] != 0) revert WithdrawalPending();
        uint256 beforeBalance = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), amount);
        if (token.balanceOf(address(this)) - beforeBalance != amount) revert UnsupportedToken();
        balanceOf[msg.sender] += amount;
        emit StakeUpdated(msg.sender, balanceOf[msg.sender], 0);
    }

    function requestWithdrawal() external {
        if (balanceOf[msg.sender] == 0) revert NoStake();
        if (withdrawableAt[msg.sender] != 0) revert WithdrawalPending();
        withdrawableAt[msg.sender] = block.timestamp + withdrawalDelay;
        emit StakeUpdated(msg.sender, balanceOf[msg.sender], withdrawableAt[msg.sender]);
    }

    function cancelWithdrawal() external {
        if (withdrawableAt[msg.sender] == 0) revert NoWithdrawal();
        withdrawableAt[msg.sender] = 0;
        emit StakeUpdated(msg.sender, balanceOf[msg.sender], 0);
    }

    function withdraw() external nonReentrant {
        uint256 unlockAt = withdrawableAt[msg.sender];
        if (unlockAt == 0) revert NoWithdrawal();
        if (block.timestamp < unlockAt) revert CooldownActive();
        uint256 amount = balanceOf[msg.sender];
        balanceOf[msg.sender] = 0;
        withdrawableAt[msg.sender] = 0;
        token.safeTransfer(msg.sender, amount);
        emit StakeUpdated(msg.sender, 0, 0);
    }

    function isActive(address wallet) external view returns (bool) {
        return balanceOf[wallet] >= minimumStake && withdrawableAt[wallet] == 0;
    }
}
