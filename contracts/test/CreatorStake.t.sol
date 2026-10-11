// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CreatorStake} from "../src/CreatorStake.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
}

contract TestToken is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract FeeToken is TestToken {
    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0) && to != address(0)) {
            super._update(from, address(0), value / 100);
            super._update(from, to, value - value / 100);
        } else { super._update(from, to, value); }
    }
}

contract CreatorStakeTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    TestToken token;
    CreatorStake stake;
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    uint256 constant MINIMUM = 500 ether;
    uint256 constant DELAY = 7 days;

    function setUp() public {
        token = new TestToken();
        stake = new CreatorStake(token, MINIMUM, DELAY);
        token.mint(ALICE, 10_000 ether);
        vm.prank(ALICE);
        token.approve(address(stake), type(uint256).max);
    }

    function depositAsAlice(uint256 amount) internal {
        vm.prank(ALICE);
        stake.deposit(amount);
    }

    function testThresholdAndTopUp() public {
        depositAsAlice(MINIMUM - 1);
        require(!stake.isActive(ALICE), "Below threshold must be inactive");
        depositAsAlice(1);
        require(stake.isActive(ALICE), "Threshold must be active");
        require(!stake.isActive(BOB), "Unfunded wallet must be inactive");
    }

    function testWithdrawalImmediatelyDisablesBadgeAndReturnsFullDeposit() public {
        depositAsAlice(MINIMUM);
        vm.prank(ALICE);
        stake.requestWithdrawal();
        require(!stake.isActive(ALICE), "Pending withdrawal must disable stake eligibility");
        vm.expectRevert(CreatorStake.CooldownActive.selector);
        vm.prank(ALICE);
        stake.withdraw();
        vm.warp(stake.withdrawableAt(ALICE));
        vm.prank(ALICE);
        stake.withdraw();
        require(token.balanceOf(ALICE) == 10_000 ether, "Full refund");
        require(stake.balanceOf(ALICE) == 0 && stake.withdrawableAt(ALICE) == 0, "State cleared");
    }

    function testCannotResetCooldownOrDepositWhilePending() public {
        depositAsAlice(MINIMUM);
        vm.prank(ALICE);
        stake.requestWithdrawal();
        vm.expectRevert(CreatorStake.WithdrawalPending.selector);
        vm.prank(ALICE);
        stake.requestWithdrawal();
        vm.expectRevert(CreatorStake.WithdrawalPending.selector);
        depositAsAlice(1);
    }

    function testCancelRestoresEligibilityAndNextRequestStartsFreshDelay() public {
        depositAsAlice(MINIMUM);
        vm.prank(ALICE);
        stake.requestWithdrawal();
        vm.warp(block.timestamp + 1 days);
        vm.prank(ALICE);
        stake.cancelWithdrawal();
        require(stake.isActive(ALICE), "Cancel restores eligibility");
        vm.prank(ALICE);
        stake.requestWithdrawal();
        require(stake.withdrawableAt(ALICE) == block.timestamp + DELAY, "Fresh cooldown");
    }

    function testOtherWalletCannotWithdrawCreatorsFunds() public {
        depositAsAlice(MINIMUM);
        vm.expectRevert(CreatorStake.NoStake.selector);
        vm.prank(BOB);
        stake.requestWithdrawal();
        vm.expectRevert(CreatorStake.NoWithdrawal.selector);
        vm.prank(BOB);
        stake.withdraw();
        require(stake.balanceOf(ALICE) == MINIMUM, "Funds unchanged");
    }

    function testRejectZeroDepositAndUnrequestedWithdrawal() public {
        vm.expectRevert(CreatorStake.InvalidAmount.selector);
        depositAsAlice(0);
        vm.expectRevert(CreatorStake.NoWithdrawal.selector);
        vm.prank(ALICE);
        stake.withdraw();
    }

    function testRejectInvalidConfiguration() public {
        vm.expectRevert(CreatorStake.InvalidConfiguration.selector);
        new CreatorStake(IERC20(address(0)), MINIMUM, DELAY);
        vm.expectRevert(CreatorStake.InvalidConfiguration.selector);
        new CreatorStake(token, 0, DELAY);
        vm.expectRevert(CreatorStake.InvalidConfiguration.selector);
        new CreatorStake(token, MINIMUM, 0);
    }

    function testRejectFeeOnTransferWithoutCreditingPhantomStake() public {
        FeeToken feeToken = new FeeToken();
        CreatorStake feeStake = new CreatorStake(feeToken, MINIMUM, DELAY);
        feeToken.mint(ALICE, MINIMUM);
        vm.prank(ALICE);
        feeToken.approve(address(feeStake), MINIMUM);
        vm.expectRevert(CreatorStake.UnsupportedToken.selector);
        vm.prank(ALICE);
        feeStake.deposit(MINIMUM);
        require(feeStake.balanceOf(ALICE) == 0, "No phantom balance");
        require(feeToken.balanceOf(ALICE) == MINIMUM, "Transfer reverted");
    }

    function testFuzzDepositConservation(uint96 rawAmount) public {
        uint256 amount = uint256(rawAmount) % (10_000 ether) + 1;
        token.mint(ALICE, 1);
        depositAsAlice(amount);
        require(stake.balanceOf(ALICE) == amount, "Ledger equals deposit");
        require(token.balanceOf(address(stake)) == amount, "Custody equals ledger");
        require(stake.isActive(ALICE) == (amount >= MINIMUM), "Threshold correctness");
    }
}
