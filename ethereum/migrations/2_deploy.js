const BalancesStateChannel = artifacts.require('BalancesStateChannel');

module.exports = function (deployer) {
  deployer.deploy(BalancesStateChannel);
};
