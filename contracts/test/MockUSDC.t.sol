// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {MockUSDC} from "../src/MockUSDC.sol";
import {CreatorStake} from "../src/CreatorStake.sol";
interface MockVm {
    function chainId(uint256) external;
    function prank(address) external;
    function expectRevert(bytes4) external;
    function warp(uint256) external;
}
contract MockUSDCTest {
    MockVm constant vm = MockVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant ALICE = address(0xA11CE);
    address constant BOB = address(0xB0B);
    function testSixDecimalsInitialSupplyAndSingleFaucetClaim() public {
        vm.chainId(10143);
        MockUSDC token = new MockUSDC(ALICE);
        require(token.decimals() == 6 && token.balanceOf(ALICE) == 10_000_000_000, "Initial units");
        vm.prank(BOB); token.faucet();
        require(token.balanceOf(BOB) == 1_000_000_000, "Faucet units");
        vm.prank(BOB); vm.expectRevert(MockUSDC.AlreadyClaimed.selector); token.faucet();
        vm.prank(ALICE); vm.expectRevert(MockUSDC.AlreadyClaimed.selector); token.faucet();
    }
    /// The stake UI gates its faucet button on this flag, so it must track claims exactly.
    function testClaimedFlagTracksFaucetEligibility() public {
        vm.chainId(10143);
        MockUSDC token = new MockUSDC(ALICE);
        require(token.claimed(ALICE) && !token.claimed(BOB), "Initial eligibility");
        vm.prank(BOB); token.faucet();
        require(token.claimed(BOB), "Claimed after faucet");
    }
    function testCannotDeployOrMintOnAnotherChain() public {
        vm.chainId(143); vm.expectRevert(MockUSDC.TestnetOnly.selector); new MockUSDC(ALICE);
        vm.chainId(10143); MockUSDC token = new MockUSDC(ALICE);
        vm.chainId(143); vm.prank(BOB); vm.expectRevert(MockUSDC.TestnetOnly.selector); token.faucet();
    }
    function testMockStakeConservationAndRefund() public {
        vm.chainId(10143);
        MockUSDC token = new MockUSDC(ALICE);
        CreatorStake stake = new CreatorStake(token, 500_000_000, 7 days);
        vm.prank(ALICE); token.approve(address(stake), 500_000_000);
        vm.prank(ALICE); stake.deposit(500_000_000);
        require(stake.isActive(ALICE) && token.allowance(ALICE, address(stake)) == 0, "Bounded deposit");
        vm.prank(ALICE); stake.requestWithdrawal();
        require(!stake.isActive(ALICE), "Pending inactive");
        vm.warp(block.timestamp + 7 days);
        vm.prank(ALICE); stake.withdraw();
        require(token.balanceOf(ALICE) == 10_000_000_000 && token.balanceOf(address(stake)) == 0, "Refund conservation");
    }
}
