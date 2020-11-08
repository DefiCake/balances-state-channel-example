# CLI

Simple CLI application that allows signing receipts, and comitting them to the sample smart contract deployed in the Goerli testnet. Just for showcase purposes.

## Setup

`yarn install` and you should be ready to go. The app has been tested under Node 10.22.0 and Yarn 1.22.4, but it should be compatible with all versions above. Then `node index.js`.

## index.js

The main script contains a simple CLI menu which lets you choose from three options: `Sign receipt`, `Update channel` and `Reset channel`.

The flow to follow would be:

- Sign a first receipt with the starting balances that will be deposited into the state channel for the two users. Recommended nonce is `1` to start. Example: Alice commits 5 tokens, Bob commits 5 tokens, and nonce is 1. Total balance locked up in the channel is 10.
- Commit this first receipt by calling a channel update. Funds will be locked.
- Sign new receipts afterwards. Ensure that the total balances in the channel do not differ from the initial state. Valid example: nonce is 2, Alice has a balance of 4, Bob has a balance of 6, total balance 10. Invalid example: nonce is 2, Alice has a balance of 10, Bob has a balance of 15.
- Update the channel whenever you want. The last state will be committed onchain. Be sure to do this at least once before going to the next step.
- When both users have finished making transactions, call a channel reset and funds will be unlocked, reflecting the last channel update on the contract onchain.
- Afterwards, you will be able to open a new channel by signing a new arbitrary receipt (can be any balance) and comitting a new channel update. Just make sure that nonce is always greater than the last comitted state.

## Artifacts

Folder containing:

- `abi.json`: ABI of the state channel contract
- `keys.json`: A pair of keys loaded with ETH to immediately start using the application
- `network.json`: A shared infura endpoint to allow access for the Goerli testnet and the address of the deployed contract

## Helpers

- `generateDatabaseIfNecessary`: helper function to generate a JSON file containing user receipts.
- `mintIfNecessary`: mints funds in the contract if the loaded keys do not have them
