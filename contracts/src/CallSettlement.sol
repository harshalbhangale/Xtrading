// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Chainlink CRE consumer interface: the KeystoneForwarder delivers verified reports here.
interface IReceiver is IERC165 {
    function onReport(bytes calldata metadata, bytes calldata report) external;
}

/// @title CallSettlement
/// @notice Opt-in bonded calls settled by a Chainlink CRE workflow (directional-return-v1).
/// @dev A call's window starts when it is registered onchain, so terms are committed before any
///      outcome is known. Entry and exit prices both come from the workflow report and must be
///      observed within PRICE_TOLERANCE of the window's start and expiry. A missing price never
///      slashes: after REFUND_DELAY the creator can reclaim the bond. Refundable CreatorStake
///      deposits are a separate contract and are never touched here. The owner configures the
///      trusted forwarder/workflow and supported assets but has no path to move user funds.
contract CallSettlement is IReceiver, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Direction {
        Up,
        Down
    }
    enum Status {
        None,
        Open,
        Success,
        Failure,
        Tie,
        Refunded
    }

    struct Call {
        address creator;
        bytes32 asset;
        Direction direction;
        uint16 targetBps;
        uint64 start;
        uint64 expiry;
        uint128 bond;
        uint128 reward;
        Status status;
        bytes32 termsHash;
        uint256 entryPrice;
        uint256 exitPrice;
    }

    /// @notice One settlement in a workflow report. Prices share a scale chosen by the workflow.
    struct Settlement {
        bytes32 callId;
        uint256 entryPrice;
        uint64 entryTime;
        uint256 exitPrice;
        uint64 exitTime;
    }

    struct DueCall {
        bytes32 callId;
        bytes32 asset;
        uint64 start;
        uint64 expiry;
    }

    uint64 public constant PRICE_TOLERANCE = 600;
    uint64 public constant REFUND_DELAY = 3 days;
    uint64 public constant MIN_HORIZON = 1 hours;
    uint64 public constant MAX_HORIZON = 30 days;
    /// @dev The workflow reads the exit candle one minute after expiry.
    uint64 public constant SETTLEMENT_DELAY = 60;

    IERC20 public immutable token;
    uint128 public immutable minBond;
    uint128 public immutable maxBond;

    address public forwarder;
    bytes32 public expectedWorkflowId;
    address public expectedWorkflowOwner;
    mapping(bytes32 asset => bool) public supportedAsset;

    /// @notice Unreserved rewards available to new calls; failed bonds flow back here.
    uint256 public rewardPool;
    uint256 public reservedRewards;
    uint256 public lockedBonds;
    uint256 public totalClaimable;
    mapping(address => uint256) public claimable;
    mapping(bytes32 callId => Call) private calls;
    bytes32[] private openIds;
    mapping(bytes32 callId => uint256) private openIndex; // index + 1; 0 = not open

    error InvalidConfiguration();
    error InvalidSender(address sender);
    error InvalidWorkflow();
    error CallExists();
    error UnsupportedAsset();
    error InvalidTerms();
    error InsufficientRewardPool();
    error NotRefundable();
    error NothingToClaim();
    error UnsupportedToken();

    event ForwarderUpdated(address forwarder);
    event WorkflowUpdated(bytes32 workflowId, address workflowOwner);
    event AssetUpdated(bytes32 indexed asset, bool supported);
    event RewardsFunded(address indexed funder, uint256 amount, uint256 rewardPool);
    event CallRegistered(
        bytes32 indexed callId,
        address indexed creator,
        bytes32 asset,
        Direction direction,
        uint16 targetBps,
        uint64 start,
        uint64 expiry,
        uint128 bond,
        uint128 reward,
        bytes32 termsHash
    );
    event CallSettled(
        bytes32 indexed callId,
        address indexed creator,
        Status outcome,
        uint256 entryPrice,
        uint256 exitPrice,
        uint256 payout,
        uint256 slashed
    );
    event SettlementRejected(bytes32 indexed callId, uint8 reason);
    event CallRefunded(bytes32 indexed callId, address indexed creator, uint256 bond);
    event Claimed(address indexed creator, uint256 amount);

    constructor(IERC20 token_, address forwarder_, uint128 minBond_, uint128 maxBond_, bytes32[] memory assets)
        Ownable(msg.sender)
    {
        if (address(token_).code.length == 0 || forwarder_ == address(0) || minBond_ == 0 || maxBond_ < minBond_) {
            revert InvalidConfiguration();
        }
        token = token_;
        forwarder = forwarder_;
        minBond = minBond_;
        maxBond = maxBond_;
        for (uint256 i; i < assets.length; ++i) {
            supportedAsset[assets[i]] = true;
            emit AssetUpdated(assets[i], true);
        }
        emit ForwarderUpdated(forwarder_);
    }

    // --- Configuration (no access to funds) ---

    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert InvalidConfiguration();
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    /// @notice Optional defence in depth: accept reports only from this workflow ID and/or owner.
    function setExpectedWorkflow(bytes32 workflowId, address workflowOwner) external onlyOwner {
        expectedWorkflowId = workflowId;
        expectedWorkflowOwner = workflowOwner;
        emit WorkflowUpdated(workflowId, workflowOwner);
    }

    function setAsset(bytes32 asset, bool supported) external onlyOwner {
        supportedAsset[asset] = supported;
        emit AssetUpdated(asset, supported);
    }

    // --- Funding and registration ---

    function fundRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidTerms();
        _pull(msg.sender, amount);
        rewardPool += amount;
        emit RewardsFunded(msg.sender, amount, rewardPool);
    }

    /// @notice Locks `bond` and reserves `reward` from the pool. The window starts now.
    function registerCall(
        bytes32 callId,
        bytes32 asset,
        Direction direction,
        uint16 targetBps,
        uint64 horizon,
        uint128 bond,
        uint128 reward,
        bytes32 termsHash
    ) external nonReentrant {
        if (callId == bytes32(0) || calls[callId].status != Status.None) revert CallExists();
        if (!supportedAsset[asset]) revert UnsupportedAsset();
        if (
            targetBps == 0 || targetBps > 10_000 || horizon < MIN_HORIZON || horizon > MAX_HORIZON || bond < minBond
                || bond > maxBond || reward > bond
        ) revert InvalidTerms();
        if (reward > rewardPool) revert InsufficientRewardPool();

        _pull(msg.sender, bond);
        rewardPool -= reward;
        reservedRewards += reward;
        lockedBonds += bond;

        uint64 start = uint64(block.timestamp);
        calls[callId] = Call({
            creator: msg.sender,
            asset: asset,
            direction: direction,
            targetBps: targetBps,
            start: start,
            expiry: start + horizon,
            bond: bond,
            reward: reward,
            status: Status.Open,
            termsHash: termsHash,
            entryPrice: 0,
            exitPrice: 0
        });
        openIds.push(callId);
        openIndex[callId] = openIds.length;
        emit CallRegistered(
            callId, msg.sender, asset, direction, targetBps, start, start + horizon, bond, reward, termsHash
        );
    }

    // --- CRE report delivery ---

    /// @inheritdoc IReceiver
    function onReport(bytes calldata metadata, bytes calldata report) external override nonReentrant {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender);
        if (expectedWorkflowId != bytes32(0) || expectedWorkflowOwner != address(0)) {
            // First 62 bytes: workflowId (32), workflowName (10), workflowOwner (20).
            if (metadata.length < 62) revert InvalidWorkflow();
            bytes32 workflowId = bytes32(metadata[0:32]);
            address workflowOwner = address(bytes20(metadata[42:62]));
            if (expectedWorkflowId != bytes32(0) && workflowId != expectedWorkflowId) revert InvalidWorkflow();
            if (expectedWorkflowOwner != address(0) && workflowOwner != expectedWorkflowOwner) {
                revert InvalidWorkflow();
            }
        }
        Settlement[] memory settlements = abi.decode(report, (Settlement[]));
        for (uint256 i; i < settlements.length; ++i) {
            _settle(settlements[i]);
        }
    }

    /// @dev Invalid entries are skipped with a reason so one bad price cannot block a batch.
    ///      Reasons: 1 not open, 2 not due, 3 entry outside window, 4 exit outside window, 5 zero price.
    function _settle(Settlement memory s) private {
        Call storage c = calls[s.callId];
        if (c.status != Status.Open) {
            emit SettlementRejected(s.callId, 1);
            return;
        }
        if (block.timestamp < c.expiry + SETTLEMENT_DELAY) {
            emit SettlementRejected(s.callId, 2);
            return;
        }
        if (s.entryTime < c.start || s.entryTime > c.start + PRICE_TOLERANCE) {
            {
                emit SettlementRejected(s.callId, 3);
                return;
            }
        }
        if (s.exitTime < c.expiry || s.exitTime > c.expiry + PRICE_TOLERANCE) {
            {
                emit SettlementRejected(s.callId, 4);
                return;
            }
        }
        if (s.entryPrice == 0 || s.exitPrice == 0) {
            emit SettlementRejected(s.callId, 5);
            return;
        }

        Status outcome;
        if (s.exitPrice == s.entryPrice) {
            outcome = Status.Tie;
        } else {
            bool up = s.exitPrice > s.entryPrice;
            uint256 move = up ? s.exitPrice - s.entryPrice : s.entryPrice - s.exitPrice;
            bool called = (c.direction == Direction.Up) == up;
            outcome = called && move * 10_000 >= s.entryPrice * c.targetBps ? Status.Success : Status.Failure;
        }

        uint256 bond = c.bond;
        uint256 reward = c.reward;
        c.status = outcome;
        c.entryPrice = s.entryPrice;
        c.exitPrice = s.exitPrice;
        lockedBonds -= bond;
        reservedRewards -= reward;
        _close(s.callId);

        uint256 payout;
        uint256 slashed;
        if (outcome == Status.Success) {
            payout = bond + reward;
        } else if (outcome == Status.Tie) {
            payout = bond;
            rewardPool += reward;
        } else {
            slashed = bond;
            rewardPool += bond + reward;
        }
        if (payout != 0) {
            claimable[c.creator] += payout;
            totalClaimable += payout;
        }
        emit CallSettled(s.callId, c.creator, outcome, s.entryPrice, s.exitPrice, payout, slashed);
    }

    // --- Timeout refund and claims ---

    /// @notice Without a settlement by expiry + REFUND_DELAY, the creator's bond is returned.
    function refundExpired(bytes32 callId) external nonReentrant {
        Call storage c = calls[callId];
        if (c.status != Status.Open || block.timestamp <= c.expiry + REFUND_DELAY) revert NotRefundable();
        uint256 bond = c.bond;
        c.status = Status.Refunded;
        lockedBonds -= bond;
        reservedRewards -= c.reward;
        rewardPool += c.reward;
        claimable[c.creator] += bond;
        totalClaimable += bond;
        _close(callId);
        emit CallRefunded(callId, c.creator, bond);
    }

    function claim() external nonReentrant {
        uint256 amount = claimable[msg.sender];
        if (amount == 0) revert NothingToClaim();
        claimable[msg.sender] = 0;
        totalClaimable -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }

    // --- Views ---

    function getCall(bytes32 callId) external view returns (Call memory) {
        return calls[callId];
    }

    function openCallCount() external view returns (uint256) {
        return openIds.length;
    }

    /// @notice Open calls whose exit price can be read now, scanning at most `limit` from `cursor`.
    function dueCalls(uint256 cursor, uint256 limit) external view returns (DueCall[] memory due, uint256 next) {
        uint256 end = cursor + limit > openIds.length ? openIds.length : cursor + limit;
        DueCall[] memory buffer = new DueCall[](end > cursor ? end - cursor : 0);
        uint256 count;
        for (uint256 i = cursor; i < end; ++i) {
            Call storage c = calls[openIds[i]];
            if (block.timestamp >= c.expiry + SETTLEMENT_DELAY) {
                buffer[count++] = DueCall(openIds[i], c.asset, c.start, c.expiry);
            }
        }
        due = new DueCall[](count);
        for (uint256 i; i < count; ++i) {
            due[i] = buffer[i];
        }
        next = end;
    }

    function supportsInterface(bytes4 interfaceId) public pure override returns (bool) {
        return interfaceId == type(IReceiver).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function _close(bytes32 callId) private {
        uint256 index = openIndex[callId] - 1;
        bytes32 last = openIds[openIds.length - 1];
        openIds[index] = last;
        openIndex[last] = index + 1;
        openIds.pop();
        delete openIndex[callId];
    }

    /// @dev Credits only what arrived, so fee-on-transfer tokens cannot create phantom balances.
    function _pull(address from, uint256 amount) private {
        uint256 before = token.balanceOf(address(this));
        token.safeTransferFrom(from, address(this), amount);
        if (token.balanceOf(address(this)) - before != amount) revert UnsupportedToken();
    }
}
