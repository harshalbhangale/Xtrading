// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// Interfaces only: deployed Kuru contracts, not imported project implementations.
interface FeeVm {
    function envOr(string calldata, string calldata) external returns (string memory);
    function createSelectFork(string calldata) external returns (uint256);
    function deal(address, uint256) external;
    function expectRevert() external;
    function skip(bool) external;
}
interface FeeToken {
    function balanceOf(address) external view returns (uint256);
    function approve(address, uint256) external returns (bool);
    function allowance(address, address) external view returns (uint256);
}
interface FeeBook {
    function placeAndExecuteMarketSell(uint96 size, uint256 minOut, bool margin, bool fillOrKill) external payable returns (uint256);
}
interface FeeFlow {
    struct Intent { address buy; uint256 minimum; address sell; uint256 amount; }
    struct Fees { address collector; uint256 fee; address recipient; uint256 referrerFee; bool inputFee; }
    function executeSwap(Intent calldata, Fees calldata, bytes calldata) external payable returns (uint256);
    function getRouter() external view returns (address);
}

contract KuruCreatorFeeForkTest {
    FeeVm constant vm = FeeVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    address constant USDC = 0x754704Bc059F8C67012fEd69BC8A327a5aafb603;
    address constant BOOK = 0x065C9d28E428A0db40191a54d33d5b7c71a9C394;
    address constant ENTRY = 0xb3e6778480b2E488385E8205eA05E20060B813cb;
    address constant ROUTER = 0x2f84FB8982073f39Ba47c7fcC29119aF074AbbcB;
    address constant CREATOR = address(0xBEEF);
    bool active;

    receive() external payable {}
    function setUp() public {
        string memory rpc = vm.envOr("KURU_FEE_FORK_RPC", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        active = true;
        vm.deal(address(this), 1000 ether);
        require(FeeFlow(ENTRY).getRouter() == ROUTER, "Unexpected router");
        // Acquire real USDC on the fork by selling native MON. No storage overrides/mints.
        FeeBook(BOOK).placeAndExecuteMarketSell{value: 100 ether}(uint96(100 * 1e10), 1, false, true);
        require(FeeToken(USDC).balanceOf(address(this)) >= 1e6, "Fork liquidity insufficient");
    }
    function program() internal pure returns (bytes memory) {
        return abi.encodePacked(uint8(2), USDC, uint8(1), uint16(65535), uint8(3), BOOK, uint8(1), uint32(1e8), uint256(1e10), uint8(6));
    }
    function execute(uint256 minimum) internal returns (uint256) {
        return FeeFlow(ENTRY).executeSwap(FeeFlow.Intent(address(0), minimum, USDC, 1e6), FeeFlow.Fees(address(0), 0, CREATOR, 50, false), program());
    }
    function testForkBuyerGetsNetOutputAndCreatorGetsFeeAtomically() public {
        vm.skip(!active);
        FeeToken(USDC).approve(ENTRY, 1e6);
        uint256 buyerBefore = address(this).balance;
        uint256 creatorBefore = CREATOR.balance;
        uint256 quoteBefore = FeeToken(USDC).balanceOf(address(this));
        uint256 net = execute(1);
        uint256 fee = CREATOR.balance - creatorBefore;
        require(net > 0 && fee > 0, "Missing payout");
        require(address(this).balance - buyerBefore == net, "Net receipt mismatch");
        require(quoteBefore - FeeToken(USDC).balanceOf(address(this)) == 1e6, "Input mismatch");
        require(fee == (net + fee) * 50 / 10000, "Fee rounding mismatch");
        require(FeeToken(USDC).allowance(address(this), ENTRY) == 0, "Exact allowance not consumed");
    }
    function testForkUnachievableMinimumRevertsTradeAndPayout() public {
        vm.skip(!active);
        FeeToken(USDC).approve(ENTRY, 1e6);
        uint256 before = FeeToken(USDC).balanceOf(address(this));
        uint256 creatorBefore = CREATOR.balance;
        vm.expectRevert();
        execute(type(uint256).max);
        require(before == FeeToken(USDC).balanceOf(address(this)), "Failed trade spent input");
        require(CREATOR.balance == creatorBefore, "Failed trade paid fee");
    }
    function testForkNoAllowanceCannotSpendOrPayCreator() public {
        vm.skip(!active);
        uint256 before = FeeToken(USDC).balanceOf(address(this));
        vm.expectRevert(); execute(1);
        require(before == FeeToken(USDC).balanceOf(address(this)), "Unauthorized spend");
    }
}
