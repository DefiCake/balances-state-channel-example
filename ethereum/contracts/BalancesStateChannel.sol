// SPDX-License-Identifier: MIT
// Author: Rafael Rodriguez Reche (rrodriguezreche, rrreche)
pragma solidity ^0.7.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";

/**
* @dev This contract showcases a very simple (and insecure) state channel for
* transfers between peers. It could be adapted to allow ERC20 / ERC777 deposits
* and made production ready by adding a couple of features, like timestamping
* signatures, replay protection attacks, etc. NOT READY FOR PRODUCTION. It
* has obvious attack vectors!
*/
contract BalancesStateChannel {
    using SafeMath for uint;
    using ECDSA for bytes32;

    struct ChannelState {
        address participant0;
        uint96 nonce;
        address participant1;
        uint balance0;
        uint balance1;
    }

    event ChannelUpdated(
        bytes32 indexed channelId,
        address indexed participant0,
        address indexed participant1,
        uint balance0,
        uint balance1,
        uint96 nonce
    );
    
    mapping(bytes32 => ChannelState) public channels;
    mapping(bytes32 => bool) public usedHashes;
    // These should be updated through a deposit, but for simplicity
    // we are just providing mint methods
    mapping(address => uint) public balances;


    // Simple functions to mint a initial balance to the sender
    function mint(uint amount) external {
        balances[msg.sender] = balances[msg.sender].add(amount);
    }

    function mintTo(address to, uint amount) external {
        balances[to] = balances[to].add(amount);
    }

    /**
     * @dev exposed function for the users to open and update payments channel
     * @notice use this function to open and update payments channel. 
     * Attach a valid state, and signatures of this state to lock funds
     * in the channel. Afterwards, update the channel offchain and finally,
     * commit the last state before unlocking the funds.
     */
    function updateChannelState(
        ChannelState calldata newChannelState, 
        bytes calldata sig0, 
        bytes calldata sig1
    ) 
        external
    {   
        bytes32 _hash = keccak256(abi.encode(newChannelState));
        require(!usedHashes[_hash], "hash was already committed");
        usedHashes[_hash] = true;

        address participant0 = _hash.toEthSignedMessageHash().recover(sig0);
        require(newChannelState.participant0 == participant0, "invalid sig0");
        require(participant0 != address(0), "invalid sig0, address 0");

        address participant1 = _hash.toEthSignedMessageHash().recover(sig1);
        require(newChannelState.participant1 == participant1, "invalid sig1");
        require(participant1 != address(0), "invalid sig1, address is 0");

        _requireSenderIsParticipant(participant0, participant1);

        bytes32 channelId = 
            keccak256(abi.encodePacked(participant0, participant1));

        ChannelState memory previousChannelState = channels[channelId];

        _requireValidTransition(previousChannelState, newChannelState);
        
        if( // Channel bootstrap
            previousChannelState.balance0 == 0 && 
            previousChannelState.balance1 == 0
        )
        {
            balances[participant0] = 
                balances[participant0].sub(newChannelState.balance0);
            balances[participant1] = 
                balances[participant1].sub(newChannelState.balance1);
        }

        channels[channelId] = newChannelState;

        emit ChannelUpdated(
            channelId,
            newChannelState.participant0,
            newChannelState.participant1,
            newChannelState.balance0,
            newChannelState.balance1,
            newChannelState.nonce
        );
    } 

    /**
     * @dev exposed function that allows to unlock funds according to the last
     * committed onchain state. 
     * @notice when you and your peer are satisfied with the transactions, 
     * update the last channel state onchain and call this method. 
     * Funds will be transfered back to you according to the last channel state.
     */
    function resetChannelState(
        address participant0, 
        address participant1
    ) 
        external 
    {
        _requireSenderIsParticipant(participant0, participant1);
        bytes32 channelId = keccak256(abi.encodePacked(participant0, participant1));

        ChannelState storage channel = channels[channelId];

        require(
            channel.balance0 > 0 || channel.balance1 > 0,
            "lock some funds into the channel first"
        );

        balances[participant0] = balances[participant0].add(channel.balance0);
        balances[participant1] = balances[participant1].add(channel.balance1);

        channel.balance0 = 0;
        channel.balance1 = 0;

        emit ChannelUpdated(
            channelId,
            channel.participant0,
            channel.participant1,
            channel.balance0,
            channel.balance1,
            channel.nonce
        );
    }

    /**
     * @dev simple helper function that could be implemented locally. Hashes 
     * a channel state.
     */
    function hashState(ChannelState memory state) public pure returns(bytes32) {
        return keccak256(abi.encode(state));
    }


    /**
     * @dev function that makes sure no illegal transitions are comitted on chain.
     * Alleviates stack too deep errors.
     */
    function _requireValidTransition(
        ChannelState memory previousChannelState,
        ChannelState memory newChannelState
    )
        public
        pure
        returns (bool)
    {
        require(
            newChannelState.nonce > previousChannelState.nonce, 
            "nonce must increment"
        );

        if( // Channel bootstrap
            previousChannelState.balance0 > 0 || 
            previousChannelState.balance1 > 0
        )
        {
            uint prevStateTotalBalance = 
                previousChannelState.balance0.add(previousChannelState.balance1);
            uint newStateTotalBalance =
                newChannelState.balance0.add(newChannelState.balance1);
            require(
                prevStateTotalBalance == newStateTotalBalance, 
                "invalid balances"
            );
        }

        return true;
    }

    /**
     * @dev function that checks message sender. Could be a modifier.
     * Alleviates stack too deep errors.
     */
    function _requireSenderIsParticipant(
        address addr0, 
        address addr1
    ) 
        internal 
        view 
    {
        require(
            msg.sender == addr0 || msg.sender == addr1, 
            "sender does not participate in this channel"
        );
    }

}
