const BalancesStateChannel = artifacts.require('BalancesStateChannel');

const { BN, keccak256, encodePacked } = require('web3-utils');
const { expectEvent, expectRevert } = require('@openzeppelin/test-helpers');

contract(
  'BalancesStateChannel',
  ([deployer, alice, bob, carol, dave, mallory, ...accounts]) => {
    const INITIAL_FUNDS = new BN(`${1e18}`);
    const MAX_TRANSFER_AMOUNT = 1000;
    const CHANNEL_ID = keccak256(
      encodePacked(
        { type: 'address', value: alice },
        { type: 'address', value: bob }
      )
    );

    let contract;

    const signHashWith = async ({ hash, address }) => {
      let signature = await web3.eth.sign(hash, address);
      const suffix = signature.substr(130) == '00' ? '1b' : '1c'; // v: 0,1 => 27,28, just needed in ganache environments
      signature = signature.substr(0, 130) + suffix;
      return signature;
    };

    const arrayifyState = ({
      participant0,
      participant1,
      nonce,
      balance0,
      balance1,
    }) => {
      return [participant0, nonce, participant1, balance0, balance1];
    };

    beforeEach('deploy contracts and setup', async () => {
      contract = await BalancesStateChannel.new();
      await contract.mint(INITIAL_FUNDS, { from: alice });
      await contract.mint(INITIAL_FUNDS, { from: bob });
    });

    describe('updateChannelState()', () => {
      it('allows to bootstrap a payment channel', async () => {
        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const nonce = '1';

        const state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        const hash = await contract.hashState(state);

        const aliceSignature = await signHashWith({ hash, address: alice });
        const bobSignature = await signHashWith({ hash, address: bob });

        const result = await contract.updateChannelState(
          state,
          aliceSignature,
          bobSignature,
          { from: alice }
        );

        expectEvent(result, 'ChannelUpdated', {
          channelId: CHANNEL_ID,
          participant0: alice,
          participant1: bob,
          balance0: randomAliceAmount,
          balance1: randomBobAmount,
          nonce,
        });

        (await contract.balances(alice)).should.be.bignumber.equal(
          INITIAL_FUNDS.sub(randomAliceAmount)
        );
        (await contract.balances(bob)).should.be.bignumber.equal(
          INITIAL_FUNDS.sub(randomBobAmount)
        );
      });

      it('rejects using same signatures', async () => {
        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const nonce = '1';

        const state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        const hash = await contract.hashState(state);

        const aliceSignature = await signHashWith({ hash, address: alice });
        const bobSignature = await signHashWith({ hash, address: bob });

        await contract.updateChannelState(state, aliceSignature, bobSignature, {
          from: alice,
        });

        await expectRevert(
          contract.updateChannelState(state, aliceSignature, bobSignature, {
            from: alice,
          }),
          'hash was already committed'
        );
      });

      it("rejects meddling in other user's channels", async () => {
        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const nonce = '1';

        const state = arrayifyState({
          participant0: carol,
          participant1: dave,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        const hash = await contract.hashState(state);

        const aliceSignature = await signHashWith({ hash, address: alice });
        const bobSignature = await signHashWith({ hash, address: bob });

        await expectRevert(
          contract.updateChannelState(state, aliceSignature, bobSignature, {
            from: alice,
          }),
          'invalid sig0'
        );
      });

      it('rejects if sender does not participate in channel', async () => {
        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const nonce = '1';

        const state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        const hash = await contract.hashState(state);

        const aliceSignature = await signHashWith({ hash, address: alice });
        const bobSignature = await signHashWith({ hash, address: bob });

        await expectRevert(
          contract.updateChannelState(state, aliceSignature, bobSignature, {
            from: mallory,
          }),
          'sender does not participate in this channel'
        );
      });

      describe('rejects when channel transition is not valid', () => {
        beforeEach('bootstrap channel', async () => {
          const randomAliceAmount = new BN(
            `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
          );
          const randomBobAmount = new BN(
            `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
          );
          const nonce = '1';

          const state = arrayifyState({
            participant0: alice,
            participant1: bob,
            nonce,
            balance0: randomAliceAmount.toString(),
            balance1: randomBobAmount.toString(),
          });
          const hash = await contract.hashState(state);

          const aliceSignature = await signHashWith({ hash, address: alice });
          const bobSignature = await signHashWith({ hash, address: bob });

          await contract.updateChannelState(
            state,
            aliceSignature,
            bobSignature,
            { from: alice }
          );
        });
        it('when nonce is not incremented', async () => {
          const nonce = '1';

          const state = arrayifyState({
            participant0: alice,
            participant1: bob,
            nonce,
            balance0: '0',
            balance1: '0',
          });

          const hash = await contract.hashState(state);
          const aliceSignature = await signHashWith({ hash, address: alice });
          const bobSignature = await signHashWith({ hash, address: bob });

          await expectRevert(
            contract.updateChannelState(state, aliceSignature, bobSignature, {
              from: alice,
            }),
            'nonce must increment'
          );
        });
        it('when balances do not add up', async () => {
          const nonce = '2';

          const state = arrayifyState({
            participant0: alice,
            participant1: bob,
            nonce,
            balance0: new BN(`${Math.ceil(Math.random() * 1000)}`).toString(),
            balance1: new BN(`${Math.ceil(Math.random() * 1000)}`).toString(),
          });

          const hash = await contract.hashState(state);
          const aliceSignature = await signHashWith({ hash, address: alice });
          const bobSignature = await signHashWith({ hash, address: bob });

          await expectRevert(
            contract.updateChannelState(state, aliceSignature, bobSignature, {
              from: alice,
            }),
            'invalid balances'
          );
        });
      });
    });

    describe('resetChannelState()', () => {
      beforeEach('setup channel and commit an update', async () => {
        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        let nonce = '1';

        let state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        let hash = await contract.hashState(state);

        let aliceSignature = await signHashWith({
          hash,
          address: alice,
        });
        let bobSignature = await signHashWith({ hash, address: bob });

        await contract.updateChannelState(state, aliceSignature, bobSignature, {
          from: alice,
        });

        nonce = '5';
        const diff = new BN(`1`);

        state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.sub(diff).toString(),
          balance1: randomBobAmount.add(diff).toString(),
        });

        hash = await contract.hashState(state);

        aliceSignature = await signHashWith({ hash, address: alice });
        bobSignature = await signHashWith({ hash, address: bob });

        await contract.updateChannelState(state, aliceSignature, bobSignature, {
          from: alice,
        });
      });

      it('allows to reset channel and recover funds', async () => {
        const sender = Math.random() < 0.5 ? alice : bob;

        const previousAliceBalance = await contract.balances(alice);
        const previousBobBalance = await contract.balances(bob);

        const {
          balance0: lockedAliceBalance,
          balance1: lockedBobBalance,
        } = await contract.channels(CHANNEL_ID);

        const result = await contract.resetChannelState(alice, bob, {
          from: sender,
        });

        expectEvent(result, 'ChannelUpdated', {
          channelId: CHANNEL_ID,
          balance0: '0',
          balance1: '0',
        });

        (await contract.balances(alice)).should.be.bignumber.equal(
          previousAliceBalance.add(lockedAliceBalance)
        );

        (await contract.balances(bob)).should.be.bignumber.equal(
          previousBobBalance.add(lockedBobBalance)
        );
      });

      it('allows to bootstrap again after reset', async () => {
        const sender = Math.random() < 0.5 ? alice : bob;

        await contract.resetChannelState(alice, bob, {
          from: sender,
        });

        const previousAliceBalance = await contract.balances(alice);
        const previousBobBalance = await contract.balances(bob);

        const randomAliceAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        const randomBobAmount = new BN(
          `${Math.ceil(Math.random() * MAX_TRANSFER_AMOUNT)}`
        );
        let nonce = '6';

        let state = arrayifyState({
          participant0: alice,
          participant1: bob,
          nonce,
          balance0: randomAliceAmount.toString(),
          balance1: randomBobAmount.toString(),
        });
        let hash = await contract.hashState(state);

        let aliceSignature = await signHashWith({
          hash,
          address: alice,
        });
        let bobSignature = await signHashWith({ hash, address: bob });

        const result = await contract.updateChannelState(
          state,
          aliceSignature,
          bobSignature,
          {
            from: alice,
          }
        );

        expectEvent(result, 'ChannelUpdated', {
          channelId: CHANNEL_ID,
          participant0: alice,
          participant1: bob,
          balance0: randomAliceAmount,
          balance1: randomBobAmount,
          nonce,
        });

        (await contract.balances(alice)).should.be.bignumber.equal(
          previousAliceBalance.sub(randomAliceAmount)
        );
        (await contract.balances(bob)).should.be.bignumber.equal(
          previousBobBalance.sub(randomBobAmount)
        );
      });

      it('rejects when called by other user', async () => {
        await expectRevert(
          contract.resetChannelState(alice, bob, { from: mallory }),
          'sender does not participate in this channel'
        );
      });

      it('rejects when channel is empty', async () => {
        await contract.resetChannelState(alice, bob, {
          from: alice,
        });

        await expectRevert(
          contract.resetChannelState(alice, bob, { from: alice }),
          'lock some funds into the channel first'
        );
      });
    });
  }
);
