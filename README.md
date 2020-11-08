# PoC: State channel for payments

## Summary

This repository contains a proof of concept of a state channel setup for offchain transfers between two peers. It could be adapted to allow external deposits from generic ERC20 tokens (approve + transferFrom) and ERC777 (direct transfer with hooks). Notice that this is just a proof of concept simplified for showcase. It is missing a lot of features for the sake of simplicity, a few of them would be:

- Timestamping the signatures so that they can't be used after a certain time has passed.
- Replay attack protection to avoid use in similar contracts or contracts in other chains.
- Generalization of channels (ie multiple parallel channels)
- Challenge periods for withdrawals.

## What are state channels

You can check what state channels are here: https://docs.statechannels.org/ . They also offer generalized state channel contracts, but this version is tailored for the use case depicted in the summary.

TL;DR: State channels use Eliptic Curve signatures for offchain transactions with a nonce. All users involved endorse channel changes. The final state of the channel is then comitted on chain by any user, reflecting the final result of all the offchain transactions by checking the validity of the last state. A rogue state cannot be comitted since some rules are enforced via smart contract (eg valid signatures from the users in the channel, nonces that must be incremental, and other rules that you might add).

## How is this repository structured

In the Ethereum folder you will find a Truffle project with all the used smart contract code and tests. This should not require an explanation if you have delved as far with general blockchain development on Ethereum as to get interested in state channels (I hope!)

In the CLI folder you will find a (hopefully simple enough) node application that takes a couple of committed JSON keys that you can use to test transfers between two users. As signatures must be committed and shared offchain, a real world scenario would imply some sort of communication between the users. In this case it is JSON file acting as a database. More information can be found in the README.md located in the folder.
