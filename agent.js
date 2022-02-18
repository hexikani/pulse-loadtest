'use strict';
const fs = require('fs');
const Web3 = require('web3');
const BN = require('bn.js');
const sleep = ms => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const ID = args[0];

const rpcNodeURL = 'ws://localhost:3334';
const walletDirPath = "wallets/";
const walletFilePath = `wallets/${args[0]}.json`;
const walletPassword = 'WouldNotGuess';

function main() {
	function log(s) {
		console.log(`${new Date().toUTCString()} {${ID}} ${s}`);
	}

	const web3 = new Web3(rpcNodeURL);
	const filePathToWallet = {};
	const gas = 21000;

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

	var lastTx = new Date();
	var lastTxStarvingNotice = null;

	async function checkAndTransfer() {
		const balanceWei = await web3.eth.getBalance(address, 'latest');
		/*try*/ {
			var gasPrice = await web3.eth.getGasPrice();
			//console.log('Gas price:', web3.utils.fromWei(gasPrice, "gwei"), " Beats");
			var bnGasLimit = new BN(gasPrice).mul(new BN(gas)).add(new BN(valueWei));
			
			var balance = web3.utils.fromWei(balanceWei, 'ether');
			// round the 10% to avoid sending too small fractions, finally convert the value to string
			var credit = "" + Math.floor(balance * 0.01 * 1e6) / 1e6;

			var valueWei = web3.utils.toWei(credit, "ether");
			//console.log("Credit:", web3.utils.fromWei(valueWei, "gwei"), "Beats", "Balance:", web3.utils.fromWei(balanceWei, "gwei"), "Beats");
			//console.log('Gas * price + value:', web3.utils.fromWei(bnGasLimit, "gwei"), "Beats");

			if(new BN(balanceWei).gte(bnGasLimit)) {
				const randomWallet = getRandomWallet();
				await transfer(credit, randomWallet.address, gasPrice, bnGasLimit);
				lastTx = new Date();
			}
			else {
				const now = new Date();
				if(now - lastTx > 10 * 1000) {
					if(lastTxStarvingNotice == null || now - lastTxStarvingNotice > 60 * 1000) {
						log(`Starving since ${lastTx.toUTCString()}`);
						lastTxStarvingNotice = new Date();
					}
				}
			}
		}
		//catch(err) {
		//	log(`Transaction FAILED (balance: ${web3.utils.fromWei(balanceWei, "gwei")} Beats = ${web3.utils.fromWei(balanceWei, 'ether')} PLS) ${err}`);
		//}
	}

	function doLoop() {
		checkAndTransfer().then(() => { setTimeout(doLoop, 100); });
	}

	doLoop();
}

main();

