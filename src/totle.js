// @flow
import type {StandardTx, SwapFuncParams} from './checkSwapService.js'

const js = require('jsonfile')
const fetch = require('node-fetch')
const Web3 = require('web3')
const { bns } = require('biggystring')
const confFileName = './config.json'
const {totleApiKey: partnerContractAddress} = js.readFileSync(confFileName)
const {checkSwapService} = require('./checkSwapService.js')

const TOTLE_CACHE = './cache/tlRaw.json'

const PRIMARY_ABI = [{'constant': true, 'inputs': [], 'name': 'tokenTransferProxy', 'outputs': [{'name': '', 'type': 'address'}], 'payable': false, 'stateMutability': 'view', 'type': 'function'}, {'constant': false, 'inputs': [], 'name': 'unpause', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': true, 'inputs': [], 'name': 'paused', 'outputs': [{'name': '', 'type': 'bool'}], 'payable': false, 'stateMutability': 'view', 'type': 'function'}, {'constant': false, 'inputs': [], 'name': 'renounceOwnership', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': true, 'inputs': [{'name': '', 'type': 'address'}], 'name': 'signers', 'outputs': [{'name': '', 'type': 'bool'}], 'payable': false, 'stateMutability': 'view', 'type': 'function'}, {'constant': false, 'inputs': [], 'name': 'pause', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': true, 'inputs': [], 'name': 'owner', 'outputs': [{'name': '', 'type': 'address'}], 'payable': false, 'stateMutability': 'view', 'type': 'function'}, {'constant': false, 'inputs': [{'name': '_token', 'type': 'address'}, {'name': '_amount', 'type': 'uint256'}], 'name': 'withdrawToken', 'outputs': [{'name': '', 'type': 'bool'}], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': false, 'inputs': [{'name': '_amount', 'type': 'uint256'}], 'name': 'withdrawETH', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': false, 'inputs': [{'name': '_newOwner', 'type': 'address'}], 'name': 'transferOwnership', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'inputs': [{'name': '_tokenTransferProxy', 'type': 'address'}, {'name': '_signer', 'type': 'address'}], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'constructor'}, {'payable': true, 'stateMutability': 'payable', 'type': 'fallback'}, {'anonymous': false, 'inputs': [{'indexed': true, 'name': 'id', 'type': 'bytes32'}, {'indexed': true, 'name': 'partnerContract', 'type': 'address'}, {'indexed': true, 'name': 'user', 'type': 'address'}], 'name': 'LogSwapCollection', 'type': 'event'}, {'anonymous': false, 'inputs': [{'indexed': true, 'name': 'id', 'type': 'bytes32'}, {'indexed': false, 'name': 'sourceAsset', 'type': 'address'}, {'indexed': false, 'name': 'destinationAsset', 'type': 'address'}, {'indexed': false, 'name': 'sourceAmount', 'type': 'uint256'}, {'indexed': false, 'name': 'destinationAmount', 'type': 'uint256'}, {'indexed': false, 'name': 'feeAsset', 'type': 'address'}, {'indexed': false, 'name': 'feeAmount', 'type': 'uint256'}], 'name': 'LogSwap', 'type': 'event'}, {'anonymous': false, 'inputs': [{'indexed': false, 'name': 'a', 'type': 'string'}, {'indexed': false, 'name': 'b', 'type': 'uint256'}, {'indexed': false, 'name': 'c', 'type': 'bytes32'}], 'name': 'Log', 'type': 'event'}, {'anonymous': false, 'inputs': [], 'name': 'Paused', 'type': 'event'}, {'anonymous': false, 'inputs': [], 'name': 'Unpaused', 'type': 'event'}, {'anonymous': false, 'inputs': [{'indexed': true, 'name': 'previousOwner', 'type': 'address'}], 'name': 'OwnershipRenounced', 'type': 'event'}, {'anonymous': false, 'inputs': [{'indexed': true, 'name': 'previousOwner', 'type': 'address'}, {'indexed': true, 'name': 'newOwner', 'type': 'address'}], 'name': 'OwnershipTransferred', 'type': 'event'}, {'constant': false, 'inputs': [{'components': [{'components': [{'components': [{'name': 'sourceToken', 'type': 'address'}, {'name': 'destinationToken', 'type': 'address'}, {'name': 'amount', 'type': 'uint256'}, {'name': 'isSourceAmount', 'type': 'bool'}, {'components': [{'name': 'exchangeHandler', 'type': 'address'}, {'name': 'encodedPayload', 'type': 'bytes'}], 'name': 'orders', 'type': 'tuple[]'}], 'name': 'trades', 'type': 'tuple[]'}, {'name': 'minimumExchangeRate', 'type': 'uint256'}, {'name': 'minimumDestinationAmount', 'type': 'uint256'}, {'name': 'sourceAmount', 'type': 'uint256'}, {'name': 'tradeToTakeFeeFrom', 'type': 'uint256'}, {'name': 'takeFeeFromSource', 'type': 'bool'}, {'name': 'redirectAddress', 'type': 'address'}, {'name': 'required', 'type': 'bool'}], 'name': 'swaps', 'type': 'tuple[]'}, {'name': 'partnerContract', 'type': 'address'}, {'name': 'expirationBlock', 'type': 'uint256'}, {'name': 'id', 'type': 'bytes32'}, {'name': 'v', 'type': 'uint8'}, {'name': 'r', 'type': 'bytes32'}, {'name': 's', 'type': 'bytes32'}], 'name': 'swaps', 'type': 'tuple'}], 'name': 'performSwapCollection', 'outputs': [], 'payable': true, 'stateMutability': 'payable', 'type': 'function'}, {'constant': false, 'inputs': [{'name': 'newSigner', 'type': 'address'}], 'name': 'addSigner', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': false, 'inputs': [{'name': 'signer', 'type': 'address'}], 'name': 'removeSigner', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}, {'constant': false, 'inputs': [{'name': 'a', 'type': 'string'}, {'name': 'b', 'type': 'uint256'}, {'name': 'c', 'type': 'bytes32'}], 'name': 'log', 'outputs': [], 'payable': false, 'stateMutability': 'nonpayable', 'type': 'function'}]
const PARITY_NODE_WEBSOCKET = 'wss://node.totlesystem.com'
const web3 = new Web3(new Web3.providers.WebsocketProvider(PARITY_NODE_WEBSOCKET))

async function doTotle (swapFuncParams: SwapFuncParams) {
  console.log('doing totle')
  return checkSwapService(fetchTotle,
    TOTLE_CACHE,
    'TL',
    swapFuncParams
  )
}

async function fetchTotle (swapFuncParams: SwapFuncParams) {
  if (!partnerContractAddress) {
    return {}
  }
  if (!swapFuncParams.useCache) {
    console.log('Fetching Totle...')
  }
  let diskCache = {offset: 0, txs: []}
  try {
    diskCache = js.readFileSync(TOTLE_CACHE)
  } catch (e) {
  }
  const cachedTransactions = diskCache.txs
  // note that offset is the last Ethereum BLOCK, not page
  const offset = diskCache.offset ? diskCache.offset : 7000000
  const currentBlockNumber = await web3.eth.getBlockNumber()
  console.log(`Read txs from cache: ${cachedTransactions.length} offset:${offset}`)
  const ssFormatTxs: Array<StandardTx> = []

  try {
    const { tokens } = await fetch('https://api.totle.com/tokens').then((res) => res.json())

    const { contracts } = await fetch('https://api.totle.com/contracts').then((res) => res.json())
    const primaries = contracts.filter(({ type }) => type === 1)

    for (const { address: primaryAddress } of primaries) {
      const primary = new web3.eth.Contract(PRIMARY_ABI, primaryAddress)
      const swapCollectionEvents = await primary.getPastEvents('LogSwapCollection', {
        filter: { partnerContract: partnerContractAddress },
        fromBlock: offset,
        toBlock: 'latest'
      })
      const payloadIds = swapCollectionEvents.map((e) => e.returnValues.id).filter((id, i, self) => self.indexOf(id) === i)
      for (const id of payloadIds) {
        const swapEvents = await primary.getPastEvents('LogSwap', {
          filter: { id },
          fromBlock: offset,
          toBlock: 'latest'
        })
        for (const swapEvent of swapEvents) {
          const { sourceAsset, destinationAsset, sourceAmount, destinationAmount } = swapEvent.returnValues

          const {timestamp} = await web3.eth.getBlock(swapEvent.blockNumber)

          const receipt = await web3.eth.getTransactionReceipt(swapEvent.transactionHash)

          const sourceToken = tokens.find((t) => t.address.toLowerCase() === sourceAsset.toLowerCase())
          const destinationToken = tokens.find((t) => t.address.toLowerCase() === destinationAsset.toLowerCase())

          // Cannot find token
          if (!sourceToken || !destinationToken) continue
          const ssTx: StandardTx = {
            status: 'complete',
            inputTXID: receipt.transactionHash,
            inputAddress: receipt.from,
            inputCurrency: sourceToken.symbol,
            inputAmount: bns.div(sourceAmount.toString(), (10 ** sourceToken.decimals).toString()),
            outputAddress: receipt.from,
            outputCurrency: destinationToken.symbol,
            outputAmount: bns.div(destinationAmount.toString(), (10 ** destinationToken.decimals).toString()),
            timestamp
          }
          // console.log(ssTx)
          ssFormatTxs.push(ssTx)
        }
      }

      // console.log(ssFormatTxs.length)
      // console.log('done....')
    }
  } catch (err) {
    console.log(err)
  }

  diskCache.offset = currentBlockNumber
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = {doTotle}
