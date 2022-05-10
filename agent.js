'use strict';
const fs = require('fs');
const Web3 = require('web3');
const BN = require('bn.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const ID = args[0];

const rpcNodeURL = 'ws://0.0.0.0:8576';
const walletDirPath = "wallets/";
const walletFilePath = `wallets/${args[0]}.json`;
const walletPassword = 'WouldNotGuess';

const burnContractAddress = '0x3de5E2E7E7Dd0859aFD8878cB708d68629453888';
const BurnContract = require('./contract/artifacts/contracts/BurnContract.sol/BurnContract.json');

async function main() {
	function log(...args) {
		console.log(`${new Date().toUTCString()} {${ID}}`, ...args);
	}

	const web3 = new Web3(rpcNodeURL);
	const filePathToWallet = {};
	const gas = 21000;

	const burnContract = new web3.eth.Contract(BurnContract.abi, burnContractAddress);

	function readWallet(walletFilePath) {
		if(walletFilePath in filePathToWallet) {
			return filePathToWallet[walletFilePath];
		}
		const json = JSON.parse(fs.readFileSync(walletFilePath));
		const wallet = web3.eth.accounts.wallet.decrypt(json, walletPassword);
		filePathToWallet[walletFilePath] = wallet[wallet.length - 1];
		return filePathToWallet[walletFilePath];
	}

	const wallet = readWallet(walletFilePath);
	const address = wallet.address;

	function getRandomWallet() {
		const filesArray = fs.readdirSync(walletDirPath).filter(file => fs.lstatSync(walletDirPath + file).isFile())
		const random = Math.floor(Math.random() * filesArray.length);
		const walletFilePath = walletDirPath + filesArray[random];
		const wallet = readWallet(walletFilePath);
		return wallet;
	}

	log(`Loaded account ${address} from wallet ${walletFilePath}`);

	async function waitForTransaction(transactionHash) {
		log(`  Waiting for transaction ${transactionHash} to be mined`);
		while(true) {
			const receipt = await web3.eth.getTransactionReceipt(transactionHash);
			if(receipt != null) {
				return receipt;
			}
			log(`   .`);
			await sleep(200);
		}
	}

	async function transfer(credit, addressTo, gasPrice, gasLimit) {
		log(`Sending ${credit} tPLS to ${addressTo} gas price ${web3.utils.fromWei(gasPrice, "gwei")} Beat, gas limit ${web3.utils.fromWei(gasLimit, "gwei")} Beat`);

		const transaction = await web3.eth.sendTransaction({
			from: address,
			to: addressTo,
			gas: gas,
			gasPrice: gasPrice,
			value: web3.utils.toWei(credit, "ether"),
		});
		log(` Transaction hash: ${transaction.transactionHash}`);
		const receipt = await waitForTransaction(transaction.transactionHash);
		log(` Transaction ${transaction.transactionHash} gas used ${receipt.gasUsed}`);
	}

	let lastTx = new Date();
	let lastTxStarvingNotice = null;

	async function testTransfer(balanceWei) {
		let gasPrice = await web3.eth.getGasPrice();
		//console.log('Gas price:', web3.utils.fromWei(gasPrice, "gwei"), " Beats");
		
		let balance = web3.utils.fromWei(balanceWei, 'ether');
		// round the 10% to avoid sending too small fractions, finally convert the value to string
		let credit = "" + Math.floor(balance * 0.01 * 1e6) / 1e6;

		let valueWei = web3.utils.toWei(credit, "ether");
		const randomWallet = getRandomWallet();
		const bnGasLimit = new BN(await web3.eth.estimateGas({
			from: address,
			to: randomWallet.address,
			amount: web3.utils.toWei(credit, "ether"),
		}));
		//console.log("Credit:", web3.utils.fromWei(valueWei, "gwei"), "Beats", "Balance:", web3.utils.fromWei(balanceWei, "gwei"), "Beats");
		//console.log('Gas * price + value:', web3.utils.fromWei(bnGasLimit, "gwei"), "Beats");


		if(new BN(balanceWei).gte(bnGasLimit)) {
			await transfer(credit, randomWallet.address, gasPrice, bnGasLimit);
			lastTx = new Date();
			return true;
		}
		return false;
	}

	async function testCallBurnContract(balanceWei) {
		if(balanceWei < 40000000)
			return false;

		const random =  Math.trunc(Math.random() * 600) + 1 + 400;
		const data = burnContract.methods.write("0", random).encodeABI();
		const bnGasLimit = new BN(await web3.eth.estimateGas({
			from: address,
			to: burnContractAddress,
			data: data,
		}));
		let gasPrice = await web3.eth.getGasPrice();
		const transaction = await web3.eth.sendTransaction({
			from: address,
			to: burnContractAddress,
			data: data,
			gasPrice: gasPrice,
			gas: bnGasLimit,
			nonce: await web3.eth.getTransactionCount(address, "latest"),
		});
		log(`BurnContract transaction submitted with ${random} writes`)
		const receipt = await waitForTransaction(transaction.transactionHash);
		log(`BurnContract transaction FINISHED, used gas: ${receipt.gasUsed}`)

		lastTx = new Date();
		return true;
	}

	async function doRandomTransaction() {
		try {
			const balanceWei = await web3.eth.getBalance(address, 'latest');
			log("Current balance", web3.utils.fromWei(balanceWei, 'ether'), "tPLS");
			if(Math.random() < 0.5)
				await testTransfer(balanceWei);
			else
				await testCallBurnContract(balanceWei);
		}
		catch(err) {
			const newBalanceWei = await web3.eth.getBalance(address, 'latest');
			log(`Transaction FAILED (balance: ${web3.utils.fromWei(newBalanceWei, 'ether')} tPLS) ${err}`);
		}

		const now = new Date();
		if(now - lastTx > 10 * 1000) {
			if(lastTxStarvingNotice == null || now - lastTxStarvingNotice > 60 * 1000) {
				log(`Starving since ${lastTx.toUTCString()}`);
				lastTxStarvingNotice = new Date();
			}
		}
	}

	while(true) {
		await doRandomTransaction();
		await sleep(1000);
	}
}

main().then(() => process.exit(0));

