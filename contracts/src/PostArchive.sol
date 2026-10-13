// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Publisher observations, not proof of X identity, accuracy or profit.
/// Full UTF-8 batch manifests live in transaction calldata and emitted event data.
contract PostArchive {
    address public immutable publisher;
    mapping(bytes32 => bool) public archived;
    error Unauthorized();
    error InvalidBatch();
    error AlreadyArchived();
    event PostBatchArchived(bytes32 indexed batchHash, address indexed recorder, uint16 count, bytes manifest);
    constructor() { publisher = msg.sender; }
    function archive(uint16 count, bytes calldata manifest) external returns (bytes32 digest) {
        if (msg.sender != publisher) revert Unauthorized();
        if (count == 0 || count > 20 || manifest.length == 0 || manifest.length > 32768) revert InvalidBatch();
        digest = keccak256(manifest);
        if (archived[digest]) revert AlreadyArchived();
        archived[digest] = true;
        emit PostBatchArchived(digest, msg.sender, count, manifest);
    }
}
