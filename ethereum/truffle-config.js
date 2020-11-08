/**
 * Use this file to configure your truffle project. It's seeded with some
 * common settings for different networks and features like migrations,
 * compilation and testing. Uncomment the ones you need or modify
 * them to suit your project as necessary.
 *
 * More information about configuration can be found at:
 *
 * truffleframework.com/docs/advanced/configuration
 *
 * To deploy via Infura you'll need a wallet provider (like truffle-hdwallet-provider)
 * to sign your transactions before they're sent to a remote public node. Infura accounts
 * are available for free at: infura.io/register.
 *
 * You'll also need a mnemonic - the twelve word phrase the wallet uses to generate
 * public/private key pairs. If you're publishing your code to GitHub make sure you load this
 * phrase from a file you've .gitignored so it doesn't accidentally become public.
 *
 */

require('chai/register-should');
const { BN } = require('web3-utils');
const chaiBN = require('chai-bn')(BN);
require('chai').use(chaiBN);

const fs = require('fs-extra');
const path = require('path');
const { toWei } = require('web3-utils');
const HDWalletProvider = require('@truffle/hdwallet-provider');

const getTestnetProvider = (testnet) => {
  const secrets = fs.readJSONSync(path.resolve(__dirname, '.secrets.json'));

  const providers = fs.readJSONSync(path.resolve(__dirname, 'endpoints.json'));

  if (secrets && secrets.mnemonic) {
    return new HDWalletProvider({
      mnemonic: secrets.mnemonic,
      providerOrUrl: providers[testnet],
    });
  } else if (secrets && secrets.length > 0) {
    return new HDWalletProvider({
      privateKeys: secrets,
      providerOrUrl: providers[testnet],
    });
  } else {
    console.trace(
      `Error: secrets file not found or not valid`,
      JSON.stringify(secrets)
    );
    throw new Error(`Secrets file not found or not valid`);
  }
};

module.exports = {
  networks: {
    // Useful for testing. The `development` name is special - truffle uses it by default
    // if it's defined here and no other network is specified at the command line.
    // You should run a client (like ganache-cli, geth or parity) in a separate terminal
    // tab if you use this network and you must also set the `host`, `port` and `network_id`
    // options below to some value.
    //
    // development: {
    //  host: "127.0.0.1",     // Localhost (default: none)
    //  port: 8545,            // Standard Ethereum port (default: none)
    //  network_id: "*",       // Any network (default: none)
    // },
    // Another network with more advanced options...
    // advanced: {
    // port: 8777,             // Custom port
    // network_id: 1342,       // Custom network
    // gas: 8500000,           // Gas sent with each transaction (default: ~6700000)
    // gasPrice: 20000000000,  // 20 gwei (in wei) (default: 100 gwei)
    // from: <address>,        // Account to send txs from (default: accounts[0])
    // websockets: true        // Enable EventEmitter interface for web3 (default: false)
    // },
    // development: {
    //   host: '127.0.0.1',
    //   port: 8545,
    //   network_id: '*',
    //   websockets: true,
    // },
    advanced: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      websockets: true,
    },
    gulp: {
      host: '127.0.0.1',
      port: 8545,
      network_id: '*',
      websockets: true,
    },
    ropsten: {
      gas: 5500000,
      network_id: '3',
      provider: () => getTestnetProvider('ropsten'),
      skipDryRun: true,
      gasPrice: 5e9,
    },
    rinkeby: {
      network_id: '4',
      provider: () => getTestnetProvider('rinkeby'),
      gas: 6721975,
      skipDryRun: true,
      gasPrice: 5e9,
    },
    kovan: {
      gas: 8000000,
      network_id: '42',
      provider: () => getTestnetProvider('kovan'),
      skipDryRun: true,
      gasPrice: 5e9,
    },
    goerli: {
      network_id: 5,
      provider: () => getTestnetProvider('goerli'),
      skipDryRun: true,
      gasPrice: 5e9,
    },
    truffle: {
      host: '127.0.0.1',
      port: 9545,
      network_id: '*',
      gas: 5500000,
    },
    // ...networks
  },

  // Set default mocha options here, use special reporters etc.
  // mocha: {
  //   // timeout: 100000
  //   reporter: 'mocha-truffle-reporter'
  // },
  plugins: ['truffle-plugin-verify'],
  api_keys: {
    etherscan: 'N3AN8X6UJ7RWTRUVGRM4VGYRJDZEC6YFAC',
  },

  // Configure your compilers
  compilers: {
    solc: {
      version: 'v0.7.1+commit.f4a555be', // Fetch exact version from solc-bin (default: truffle's version)
      settings: {
        // See the solidity docs for advice about optimization and evmVersion
        optimizer: {
          enabled: true,
          runs: 200,
        },
        // evmVersion: 'byzantium'
      },
    },
  },
};
