// Dependencies
const Web3 = require('web3');
const { BN, isAddress, isBN, keccak256, encodePacked } = require('web3-utils');
const HDWalletProvider = require('@truffle/hdwallet-provider');
const fs = require('fs-extra');
const path = require('path');
const inquirer = require('inquirer');

// Helpers
const generateReceiptDatabaseIfNecessary = require('./helpers/generateDatabaseIfNecessary');
const mintIfNecessary = require('./helpers/mintIfNecessary');

// Artifacts parameters, constants
const BASE_PATH = path.resolve(__dirname, './artifacts');
const privateKeys = fs.readJSONSync(`${BASE_PATH}/keys.json`);
const { endpoint, address } = fs.readJSONSync(`${BASE_PATH}/network.json`);
const abi = fs.readJSONSync(`${BASE_PATH}/abi.json`);
const RECEIPTS_DATABASE_PATH = path.resolve(__dirname, './receipts.json');

// Menu actions
const SIGN_NEW_RECEIPT = 'Sign new receipt';
const UPDATE_CHANNEL = 'Update channel';
const RESET_CHANNEL = 'Reset channel and unlock funds';
const EXIT = 'Exit';

// Instances
const provider = new HDWalletProvider({ privateKeys, providerOrUrl: endpoint });
const web3 = new Web3(provider);
const contract = new web3.eth.Contract(abi, address);

// This function signs a new state between Alice and Bob and commits it to
// the local database
const signReceipt = async ({ balance0, balance1, nonce }) => {
  const [alice, bob] = await web3.eth.getAccounts();

  if (!isBN(balance0)) {
    return;
  }

  if (!isBN(balance1)) {
    return;
  }

  const state = [
    alice,
    nonce.toString(),
    bob,
    balance0.toString(),
    balance1.toString(),
  ];
  const hash = await contract.methods.hashState(state).call();
  const sig0 = await web3.eth.accounts.sign(hash, privateKeys[0]);
  const sig1 = await web3.eth.accounts.sign(hash, privateKeys[1]);

  const receipts = fs.readJSONSync(RECEIPTS_DATABASE_PATH);
  receipts.push({ state, hash, sig0, sig1, committed: false });
  fs.writeJSONSync(RECEIPTS_DATABASE_PATH, receipts);
};

// This function makes an onchain transaction to update channel state.
// There is no challenge period for these updates, be aware.
const updateChannel = async () => {
  const [alice, bob] = await web3.eth.getAccounts();

  let receipts = fs
    .readJSONSync(RECEIPTS_DATABASE_PATH)
    .filter(
      (receipt) =>
        (receipt.state[0] == alice && receipt.state[2] == bob) ||
        (receipt.state[0] == bob && receipt.state[2] == alice)
    );

  if (!receipts || receipts.length === 0) {
    console.log('> No receipts found in database');
    return;
  }

  const { state, sig0, sig1, committed, index } = receipts.reduce(
    (lastReceipt, receipt, currentIndex) => {
      if (currentIndex == 0) {
        lastReceipt.index = 0;
      }

      if (
        !lastReceipt ||
        parseInt(lastReceipt.state[1]) < parseInt(receipt.state[1])
      ) {
        lastReceipt = { ...receipt, index: currentIndex };
      }
      return lastReceipt;
    },
    receipts[0]
  );

  if (committed) {
    console.log(
      `\t> Last receipt (nonce: ${state[1]}) is marked as committed, skipping`
    );
    return;
  }

  const channelId = keccak256(
    encodePacked(
      { type: 'address', value: alice },
      { type: 'address', value: bob }
    )
  );
  const previousState = await contract.methods.channels(channelId).call();

  if (parseInt(previousState.nonce) >= parseInt(state[1])) {
    console.log(
      `\t> Provided nonce is ${nonce}, must be greater than current commited nonce (${previousState.nonce})`
    );
    return;
  }

  await new Promise((resolve, reject) => {
    console.log(`Updating channel state on-chain...`);
    contract.methods
      .updateChannelState(state, sig0.signature, sig1.signature)
      .send({ from: alice })
      .on('receipt', (receipt) => {
        console.log(`\t> Transaction approved`);
        console.log(
          `\t> https://goerli.etherscan.io/tx/${receipt.transactionHash}`
        );
        console.log(`\t> Waiting for a confirmation...`);
      })
      .on('confirmation', (number, receipt) => {
        if (number === 2) {
          console.log(`\t> Confirmed`);
          resolve(receipt);
        }
      })
      .on('error', reject);
  });

  receipts[index].committed = true;

  fs.writeJSONSync(RECEIPTS_DATABASE_PATH, receipts);
};

// Closes the current channel state and unlocks funds.
// No challenge period, be aware
const resetChannel = async () => {
  const [alice, bob] = await web3.eth.getAccounts();

  await new Promise((resolve, reject) => {
    console.log(`Resetting channel and unlocking funds...`);
    contract.methods
      .resetChannelState(alice, bob)
      .send({ from: alice })
      .on('receipt', (receipt) => {
        console.log(`\t> Transaction approved`);
        console.log(
          `\t> https://goerli.etherscan.io/tx/${receipt.transactionHash}`
        );
        console.log(`\t> Waiting for a confirmation...`);
      })
      .on('confirmation', (number, receipt) => {
        if (number === 2) {
          console.log(`\t> Confirmed`);
          resolve(receipt);
        }
      })
      .on('error', reject);
  });
};

const main = async () => {
  try {
    generateReceiptDatabaseIfNecessary(RECEIPTS_DATABASE_PATH);
    await mintIfNecessary(web3, contract);
  } catch (e) {
    console.trace(e);
    console.log(`> Exiting...`);
    process.exit(1);
  }

  while (true) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    console.log(`\n\n`);
    try {
      const { action } = await inquirer.prompt([
        {
          name: 'action',
          type: 'list',
          message: 'What do you want to do?',
          choices: [SIGN_NEW_RECEIPT, UPDATE_CHANNEL, RESET_CHANNEL, EXIT],
        },
      ]);

      switch (action) {
        case SIGN_NEW_RECEIPT:
          const { balance0, balance1, nonce } = await inquirer.prompt([
            {
              name: 'balance0',
              type: 'input',
              message: 'New balance for Alice',
            },
            {
              name: 'balance1',
              type: 'input',
              message: 'New balance for Bob',
            },
            { name: 'nonce', type: 'input', message: 'Nonce' },
          ]);
          await signReceipt({
            balance0: new BN(balance0),
            balance1: new BN(balance1),
            nonce: new BN(nonce),
          });
          break;
        case UPDATE_CHANNEL:
          await updateChannel();
          break;
        case RESET_CHANNEL:
          await resetChannel();
          break;
        case EXIT:
          console.log('Bye!');
          process.exit(0);
        default:
          console.error('Impossible condition reached. Exiting...');
          process.exit(1);
      }
    } catch (e) {
      console.error(e);
    }
  }
};

main();
