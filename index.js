const Web3 = require("web3");
const contract = require("@truffle/contract");

let web3;
const BN = new Web3().utils.BN;
const ERC20DetailedABI = require("./abi/ERC20Detailed.json");
const ERC20Detailed = contract(ERC20DetailedABI);

// const setWeb3 = (web3Instance) => {
//   web3 = web3Instance;
//   ERC20Detailed.setProvider(web3.currentProvider);
// };
const setCurrentProvider = (provider) => {
  // web3 = new Web3(new Web3.providers.HttpProvider(providerURL));
  web3 = new Web3(provider);
  ERC20Detailed.setProvider(web3.currentProvider);
};

const print = async (txHash, customAddrToName, displayOverallBalChange) => {

  const tx = await web3.eth.getTransactionReceipt(txHash);
  // make addresses lowercase
  for (addr in customAddrToName) {
    customAddrToName[addr.toLowerCase()] = customAddrToName[addr];
  }
  // append to our object
  var addressToName = {
    [tx.from.toLowerCase()]: "SENDER",
    [tx.to.toLowerCase()]: "RECEIVER",
    ...customAddrToName
  };

  const getName = (addr) => {
    return addressToName[addr.toLowerCase()] || addr;
  };
  const toDecimal = (amount, decimals) => {
    decimals = parseInt(decimals);
    const divisor = new BN("10").pow(new BN(decimals));
    const beforeDec = new BN(amount).div(divisor).toString();
    var afterDec = new BN(amount).mod(divisor).toString();

    if (afterDec.length < decimals && afterDec != "0") {
      // pad with extra zeroes
      pad = Array(decimals + 1).join("0");
      afterDec = (pad + afterDec).slice(-decimals);
    }

    return (beforeDec + "." + afterDec);
  };

  const logs = tx.logs;
  const eventInterface = {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "from",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "to",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
    ],
    name: "Transfer",
    type: "event",
  };
  const eventSig = web3.eth.abi.encodeEventSignature(eventInterface);
  const transferLogs = logs.filter((l) => l.topics.includes(eventSig));

  var transfers = [];
  var balances = {};
  for (const log of transferLogs) {
    const r = web3.eth.abi.decodeLog(
      eventInterface.inputs,
      log.data,
      log.topics.slice(1)
    );
    const token = await ERC20Detailed.at(log.address);
    const tokenSymbol = await token.symbol();
    const decimals = await token.decimals();

    const fromName = getName(r.from);
    const toName = getName(r.to);
    const value = toDecimal(r.value, decimals);

    transfers.push({
      from: fromName,
      to: toName,
      value: value,
      token: tokenSymbol,
    });

    if (displayOverallBalChange) {
      // cases to avoid undefined error
      if (balances[fromName]) {
        if (balances[fromName][tokenSymbol]) {
          balances[fromName][tokenSymbol] -= parseFloat(value);
        } else {
          balances[fromName][tokenSymbol] = -parseFloat(value);
        }
      } else {
        balances[fromName] = {
          [tokenSymbol]: -parseFloat(value)
        };
      }

      if (balances[toName]) {
        if (balances[toName][tokenSymbol]) {
          balances[toName][tokenSymbol] += parseFloat(value);
        } else {
          balances[toName][tokenSymbol] = parseFloat(value);
        }
      } else {
        balances[toName] = {
          [tokenSymbol]: parseFloat(value)
        };
      }
    }
  }
  console.table(transfers);

  if (displayOverallBalChange) {
    console.log("Balance Changes:");
    console.table(balances);
  }
};

module.exports = { setCurrentProvider, print };
