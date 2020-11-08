const { BN } = require('web3-utils');

const MINT_AMOUNT = new BN(`${1e18}`);

const mintIfNecessary = async (web3, contract) => {
  const [alice, bob] = await web3.eth.getAccounts();

  const aliceBalance = await contract.methods.balances(alice).call();
  const bobBalance = await contract.methods.balances(bob).call();

  if (aliceBalance.toString() === '0') {
    console.log('> Alice does not have balance, calling mint');
    await mint({ contract, from: alice });
  }

  if (bobBalance === '0') {
    console.log('> Bob does not have balance, calling mint');
    await mint({ contract, from: bob });
  }
};

const mint = ({ contract, from }) => {
  return new Promise((resolve, reject) => {
    contract.methods
      .mint(MINT_AMOUNT)
      .send({ from, gasPrice: 5e9 })
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

module.exports = mintIfNecessary;
