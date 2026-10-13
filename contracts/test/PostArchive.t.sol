// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {PostArchive} from "../src/PostArchive.sol";
interface ArchiveVm {function prank(address) external;function expectRevert(bytes4) external;}
contract PostArchiveTest {
    ArchiveVm constant vm=ArchiveVm(address(uint160(uint256(keccak256("hevm cheat code")))));
    function testManifestHashAndDuplicateProtection() public {PostArchive a=new PostArchive();bytes memory data=bytes('{"version":1,"posts":[{"text":"Buy MON"}]}');bytes32 hash=a.archive(1,data);require(hash==keccak256(data)&&a.archived(hash),"hash");vm.expectRevert(PostArchive.AlreadyArchived.selector);a.archive(1,data);}
    function testOnlyPublisher() public {PostArchive a=new PostArchive();vm.prank(address(0xBEEF));vm.expectRevert(PostArchive.Unauthorized.selector);a.archive(1,bytes("x"));}
    function testRejectEmptyOversizedAndInvalidCount() public {PostArchive a=new PostArchive();vm.expectRevert(PostArchive.InvalidBatch.selector);a.archive(0,bytes("x"));vm.expectRevert(PostArchive.InvalidBatch.selector);a.archive(21,bytes("x"));vm.expectRevert(PostArchive.InvalidBatch.selector);a.archive(1,bytes(""));vm.expectRevert(PostArchive.InvalidBatch.selector);a.archive(1,new bytes(32769));}
    function testNoFundsRequired() public {PostArchive a=new PostArchive();a.archive(10,bytes("ten observed posts"));require(address(a).balance==0,"funds");}
}
