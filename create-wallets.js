'use strict';
const fs = require('fs');
const querystring = require('querystring')
const Web3 = require('web3');

const args = process.argv.slice(2);

const walletFilePath = `wallets/${args[0]}.json`;
const walletPassword = 'WouldNotGuess';

var web3 = new Web3();

var wallet = web3.eth.accounts.wallet.create(1);
console.log(`Saving wallet ${wallet[0].address} to ${walletFilePath}`);
fs.writeFileSync(walletFilePath, JSON.stringify(wallet.encrypt(walletPassword)));
