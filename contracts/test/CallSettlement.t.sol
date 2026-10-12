// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {CallSettlement, IReceiver} from "../src/CallSettlement.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

interface Vm {
    function prank(address) external;
    function warp(uint256) external;
    function expectRevert(bytes4) external;
    function expectRevert(bytes calldata) external;
}

contract SettlementToken is ERC20 {
    constructor() ERC20("Test USD", "tUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract CallSettlementTest {
    Vm constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    SettlementToken token;
    CallSettlement settlement;
    address constant FORWARDER = address(0xF0);
    address constant CREATOR = address(0xC0);
    address constant SPONSOR = address(0x5);
    address constant STRANGER = address(0xBAD);
    bytes32 constant ETH = "ETH";
    bytes32 constant ID = keccak256("post-1");
    uint64 constant T0 = 1_800_000_000;
    uint128 constant BOND = 100e6;
    uint128 constant REWARD = 50e6;

    function setUp() public {
        vm.warp(T0);
        token = new SettlementToken();
        bytes32[] memory assets = new bytes32[](3);
        assets[0] = "BTC";
        assets[1] = ETH;
        assets[2] = "SOL";
        settlement = new CallSettlement(token, FORWARDER, 10e6, 1000e6, assets);
        token.mint(CREATOR, 10_000e6);
        token.mint(SPONSOR, 10_000e6);
        vm.prank(CREATOR);
        token.approve(address(settlement), type(uint256).max);
        vm.prank(SPONSOR);
        token.approve(address(settlement), type(uint256).max);
        vm.prank(SPONSOR);
        settlement.fundRewards(500e6);
    }

    // --- helpers ---

    function register(bytes32 id, CallSettlement.Direction direction, uint16 targetBps) internal {
        vm.prank(CREATOR);
        settlement.registerCall(id, ETH, direction, targetBps, 1 days, BOND, REWARD, keccak256("terms"));
    }

    function report(bytes32 id, uint256 entry, uint64 entryTime, uint256 exit, uint64 exitTime) internal {
        CallSettlement.Settlement[] memory s = new CallSettlement.Settlement[](1);
        s[0] = CallSettlement.Settlement(id, entry, entryTime, exit, exitTime);
        vm.prank(FORWARDER);
        settlement.onReport("", abi.encode(s));
    }

    function settleAtExpiry(bytes32 id, uint256 entry, uint256 exit) internal {
        vm.warp(T0 + 1 days + 60);
        report(id, entry, T0 + 30, exit, T0 + 1 days + 30);
    }

    function status(bytes32 id) internal view returns (CallSettlement.Status) {
        return settlement.getCall(id).status;
    }

    /// Every token the contract holds is accounted to exactly one bucket.
    function assertConserved() internal view {
        require(
            token.balanceOf(address(settlement))
                == settlement.rewardPool() + settlement.reservedRewards() + settlement.lockedBonds()
                    + settlement.totalClaimable(),
            "not conserved"
        );
    }

    // --- registration ---

    function testRegistrationLocksBondAndReservesReward() public {
        register(ID, CallSettlement.Direction.Up, 1);
        CallSettlement.Call memory c = settlement.getCall(ID);
        require(c.creator == CREATOR && c.start == T0 && c.expiry == T0 + 1 days, "terms");
        require(settlement.lockedBonds() == BOND && settlement.reservedRewards() == REWARD, "locked");
        require(settlement.rewardPool() == 450e6, "pool");
        require(token.balanceOf(CREATOR) == 10_000e6 - BOND, "pulled");
        assertConserved();
    }

    function testRejectsInvalidRegistrations() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.CallExists.selector);
        settlement.registerCall(ID, ETH, CallSettlement.Direction.Up, 1, 1 days, BOND, 0, 0);

        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.UnsupportedAsset.selector);
        settlement.registerCall(keccak256("x"), "DOGE", CallSettlement.Direction.Up, 1, 1 days, BOND, 0, 0);

        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.InvalidTerms.selector);
        settlement.registerCall(keccak256("x"), ETH, CallSettlement.Direction.Up, 1, 30 minutes, BOND, 0, 0);

        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.InvalidTerms.selector);
        settlement.registerCall(keccak256("x"), ETH, CallSettlement.Direction.Up, 1, 1 days, 5e6, 0, 0);

        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.InvalidTerms.selector);
        settlement.registerCall(keccak256("x"), ETH, CallSettlement.Direction.Up, 1, 1 days, BOND, BOND + 1, 0);

        vm.prank(CREATOR);
        vm.expectRevert(CallSettlement.InsufficientRewardPool.selector);
        settlement.registerCall(keccak256("x"), ETH, CallSettlement.Direction.Up, 1, 1 days, 1000e6, 1000e6, 0);
    }

    // --- outcomes ---

    function testSuccessPaysBondPlusReward() public {
        register(ID, CallSettlement.Direction.Up, 500); // needs +5%
        settleAtExpiry(ID, 2000e8, 2100e8); // exactly +5%
        require(status(ID) == CallSettlement.Status.Success, "success");
        require(settlement.claimable(CREATOR) == BOND + REWARD, "payout");
        require(settlement.lockedBonds() == 0 && settlement.reservedRewards() == 0, "released");
        assertConserved();
        vm.prank(CREATOR);
        settlement.claim();
        require(token.balanceOf(CREATOR) == 10_000e6 + REWARD, "claimed");
        assertConserved();
    }

    function testLosingCallSlashesOnlyTheBondIntoThePool() public {
        register(ID, CallSettlement.Direction.Up, 500);
        settleAtExpiry(ID, 2000e8, 2099e8); // +4.95%: short of target
        require(status(ID) == CallSettlement.Status.Failure, "failure");
        require(settlement.claimable(CREATOR) == 0, "no payout");
        // Bond slashed into the pool and the reserved reward released back.
        require(settlement.rewardPool() == 500e6 + BOND, "pool");
        require(token.balanceOf(CREATOR) == 10_000e6 - BOND, "only bond lost");
        assertConserved();
    }

    function testDownCalls() public {
        register(ID, CallSettlement.Direction.Down, 1);
        settleAtExpiry(ID, 2000e8, 1999e8);
        require(status(ID) == CallSettlement.Status.Success, "down success");
        bytes32 id2 = keccak256("post-2");
        vm.warp(T0);
        register(id2, CallSettlement.Direction.Down, 1);
        settleAtExpiry(id2, 2000e8, 2001e8);
        require(status(id2) == CallSettlement.Status.Failure, "down failure");
        assertConserved();
    }

    function testTieReturnsBondWithoutReward() public {
        register(ID, CallSettlement.Direction.Up, 1);
        settleAtExpiry(ID, 2000e8, 2000e8);
        require(status(ID) == CallSettlement.Status.Tie, "tie");
        require(settlement.claimable(CREATOR) == BOND, "bond back");
        require(settlement.rewardPool() == 500e6, "reward released");
        assertConserved();
    }

    // --- report validation ---

    function testOnlyTheForwarderCanReport() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.warp(T0 + 1 days + 60);
        CallSettlement.Settlement[] memory s = new CallSettlement.Settlement[](1);
        s[0] = CallSettlement.Settlement(ID, 1, T0, 2, T0 + 1 days);
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(CallSettlement.InvalidSender.selector, STRANGER));
        settlement.onReport("", abi.encode(s));
        require(status(ID) == CallSettlement.Status.Open, "unchanged");
    }

    function testWorkflowIdentityIsEnforcedWhenConfigured() public {
        bytes32 workflowId = keccak256("workflow");
        address workflowOwner = address(0xABCD);
        settlement.setExpectedWorkflow(workflowId, workflowOwner);
        register(ID, CallSettlement.Direction.Up, 1);
        vm.warp(T0 + 1 days + 60);
        CallSettlement.Settlement[] memory s = new CallSettlement.Settlement[](1);
        s[0] = CallSettlement.Settlement(ID, 1, T0, 2, T0 + 1 days);
        bytes memory payload = abi.encode(s);

        bytes memory wrong = abi.encodePacked(keccak256("other"), bytes10("settle"), workflowOwner, bytes2(0));
        vm.prank(FORWARDER);
        vm.expectRevert(CallSettlement.InvalidWorkflow.selector);
        settlement.onReport(wrong, payload);

        // Production forwarders pass 64 bytes: 62-byte identity plus a 2-byte report ID.
        bytes memory right = abi.encodePacked(workflowId, bytes10("settle"), workflowOwner, bytes2(0x0001));
        vm.prank(FORWARDER);
        settlement.onReport(right, payload);
        require(status(ID) == CallSettlement.Status.Success, "accepted");
    }

    function testReplayedOrDuplicateReportsPayOnce() public {
        register(ID, CallSettlement.Direction.Up, 1);
        settleAtExpiry(ID, 2000e8, 2100e8);
        uint256 once = settlement.claimable(CREATOR);
        report(ID, 2000e8, T0 + 30, 1000e8, T0 + 1 days + 30); // replay with a losing price
        require(settlement.claimable(CREATOR) == once, "paid once");
        require(status(ID) == CallSettlement.Status.Success, "final");
        assertConserved();
    }

    function testRejectsPrematureAndOutOfWindowPrices() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.warp(T0 + 1 days); // before expiry + settlement delay
        report(ID, 2000e8, T0, 2100e8, T0 + 1 days);
        require(status(ID) == CallSettlement.Status.Open, "premature");

        vm.warp(T0 + 1 days + 60);
        report(ID, 2000e8, T0 + 601, 2100e8, T0 + 1 days); // entry too late
        report(ID, 2000e8, T0 - 1, 2100e8, T0 + 1 days); // entry before start
        report(ID, 2000e8, T0, 2100e8, T0 + 1 days - 1); // exit before expiry
        report(ID, 2000e8, T0, 2100e8, T0 + 1 days + 601); // exit too late
        report(ID, 0, T0, 2100e8, T0 + 1 days); // missing price
        require(status(ID) == CallSettlement.Status.Open, "still open");
        require(settlement.lockedBonds() == BOND, "bond still locked");
        assertConserved();
    }

    function testBatchSkipsBadEntriesAndSettlesGoodOnes() public {
        register(ID, CallSettlement.Direction.Up, 1);
        bytes32 id2 = keccak256("post-2");
        register(id2, CallSettlement.Direction.Down, 1);
        vm.warp(T0 + 1 days + 60);
        CallSettlement.Settlement[] memory s = new CallSettlement.Settlement[](3);
        s[0] = CallSettlement.Settlement(ID, 2000e8, T0, 2100e8, T0 + 1 days);
        s[1] = CallSettlement.Settlement(keccak256("unknown"), 1, T0, 2, T0 + 1 days);
        s[2] = CallSettlement.Settlement(id2, 0, T0, 2100e8, T0 + 1 days);
        vm.prank(FORWARDER);
        settlement.onReport("", abi.encode(s));
        require(status(ID) == CallSettlement.Status.Success, "good settled");
        require(status(id2) == CallSettlement.Status.Open, "missing price left open");
        assertConserved();
    }

    // --- refunds, due list and configuration ---

    function testMissingPriceNeverSlashesAndRefundsAfterDelay() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.warp(T0 + 1 days + 3 days);
        vm.expectRevert(CallSettlement.NotRefundable.selector);
        settlement.refundExpired(ID);
        vm.warp(T0 + 1 days + 3 days + 1);
        vm.prank(STRANGER); // anyone may trigger; funds still go to the creator
        settlement.refundExpired(ID);
        require(status(ID) == CallSettlement.Status.Refunded, "refunded");
        require(settlement.claimable(CREATOR) == BOND && settlement.rewardPool() == 500e6, "returned");
        vm.expectRevert(CallSettlement.NotRefundable.selector);
        settlement.refundExpired(ID);
        assertConserved();
    }

    function testDueCallsPaginatesOnlyExpiredOpenCalls() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.warp(T0 + 2 hours);
        bytes32 id2 = keccak256("post-2");
        vm.prank(CREATOR);
        settlement.registerCall(id2, ETH, CallSettlement.Direction.Up, 1, 1 hours, BOND, 0, 0);
        vm.warp(T0 + 3 hours + 60);
        (CallSettlement.DueCall[] memory due, uint256 next) = settlement.dueCalls(0, 10);
        require(due.length == 1 && due[0].callId == id2 && next == 2, "only expired");
        (due, next) = settlement.dueCalls(0, 1);
        require(due.length == 0 && next == 1, "bounded scan");
        report(id2, 2000e8, T0 + 2 hours, 2001e8, T0 + 3 hours);
        require(settlement.openCallCount() == 1, "closed");
    }

    function testOwnerCannotMoveFunds() public {
        register(ID, CallSettlement.Direction.Up, 1);
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", STRANGER));
        settlement.setForwarder(STRANGER);
        vm.expectRevert(CallSettlement.NothingToClaim.selector);
        settlement.claim(); // owner has no claimable balance
        assertConserved();
    }

    function testSupportsReceiverInterface() public view {
        require(settlement.supportsInterface(type(IReceiver).interfaceId), "receiver");
        require(settlement.supportsInterface(type(IERC165).interfaceId), "erc165");
        require(!settlement.supportsInterface(0xffffffff), "none");
    }

    /// Outcome matches the integer rule for any prices and target.
    function testFuzzOutcomeRule(uint96 entry, uint96 exit, uint16 targetBps, bool up) public {
        if (entry == 0 || exit == 0) return;
        targetBps = uint16(1 + (targetBps % 10_000));
        register(ID, up ? CallSettlement.Direction.Up : CallSettlement.Direction.Down, targetBps);
        settleAtExpiry(ID, entry, exit);
        CallSettlement.Status expected;
        if (exit == entry) {
            expected = CallSettlement.Status.Tie;
        } else {
            uint256 move = exit > entry ? uint256(exit) - entry : uint256(entry) - exit;
            bool right = up == (exit > entry);
            expected = right && move * 10_000 >= uint256(entry) * targetBps
                ? CallSettlement.Status.Success
                : CallSettlement.Status.Failure;
        }
        require(status(ID) == expected, "rule");
        assertConserved();
    }
}
