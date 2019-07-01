// @flow
import type { ShapeShiftTx, SwapFuncParams } from './checkSwapService.js'

const js = require('jsonfile')
const fetch = require('node-fetch')
const Web3 = require('web3')
const confFileName = './config.json'
const { totleApiKey: affiliateAddress } = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const TOTLE_CACHE = './cache/tlRaw.json'

const PRIMARY_ADDRESS = '0xCf686b9C6d185d0091d07Df8B9953702c78B0C20'
const PRIMARY_ABI = [
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'id', type: 'bytes32' },
      { indexed: false, name: 'totalEthTraded', type: 'uint256' },
      { indexed: false, name: 'totalFee', type: 'uint256' },
      { indexed: false, name: 'feeAccount', type: 'address' }
    ],
    name: 'LogRebalance',
    type: 'event',
    signature:
      '0x5e7255197ab292e0e4ff7d5ec6990a0741484fb6ffc00989f0163e445accf7ff'
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'isSell', type: 'bool' },
      { indexed: false, name: 'token', type: 'address' },
      { indexed: false, name: 'ethAmount', type: 'uint256' },
      { indexed: false, name: 'tokenAmount', type: 'uint256' }
    ],
    name: 'LogTrade',
    type: 'event',
    signature:
      '0xc06a42f44fb6bcf7da1c50059cceb5b99a5a315a904dd33ac5fcf0f16b55dcdc'
  }
]

const LOG_TRADE_ABI: Object = PRIMARY_ABI.find(({ name }) => name === 'LogTrade') || {}
const PARITY_NODE_WEBSOCKET = 'wss://node.totlesystem.com'
const web3 = new Web3(
  new Web3.providers.WebsocketProvider(PARITY_NODE_WEBSOCKET)
)

async function doTotle (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchTotle, TOTLE_CACHE, 'TL', swapFuncParams)
}

async function fetchTotle (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Totle...')
  }
  let diskCache = { offset: 0, txs: [] }
  try {
    diskCache = js.readFileSync(TOTLE_CACHE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  let offset = diskCache.offset ? diskCache.offset : 0
  // console.log(`Read txs from cache: ${cachedTransactions.length} offset:${offset}`)
  const ssFormatTxs: Array<ShapeShiftTx> = []

  while (1 && !swapFuncParams.useCache) {
    try {
      const { tokens } = await fetch(
        'https://services.totlesystem.com/tokens'
      ).then(res => res.json())

      const primary = new web3.eth.Contract(PRIMARY_ABI, PRIMARY_ADDRESS)
      const events = await primary.getPastEvents('LogRebalance', {
        fromBlock: 7000000,
        toBlock: 'latest'
      })

      for (const event of events) {
        const { feeAccount } = event.returnValues

        if (feeAccount.toLowerCase() !== affiliateAddress) continue

        const { timestamp } = await web3.eth.getBlock(event.blockNumber)

        const receipt = await web3.eth.getTransactionReceipt(
          event.transactionHash
        )
        const logs = receipt.logs.filter(
          ({ topics: [topic] }) => topic === LOG_TRADE_ABI.signature
        )
        for (const log of logs) {
          const {
            isSell,
            token: tokenAddress,
            tokenAmount,
            ethAmount
          } = web3.eth.abi.decodeLog(
            LOG_TRADE_ABI.inputs,
            log.data,
            log.topics
          )

          const token = tokens.find(
            t => t.address.toLowerCase() === tokenAddress.toLowerCase()
          )
          // Cannot find token
          if (!token) continue

          const ssTx: ShapeShiftTx = {
            status: 'complete',
            inputTXID: receipt.transactionHash,
            inputAddress: receipt.from,
            inputCurrency: isSell ? token.symbol : 'ETH',
            inputAmount: isSell ? tokenAmount.toString() : ethAmount.toString(),
            outputAddress: receipt.from,
            outputCurrency: isSell ? 'ETH' : token.symbol,
            outputAmount: isSell
              ? ethAmount.toString()
              : tokenAmount.toString(),
            timestamp
          }
          console.log(ssTx)
          ssFormatTxs.push(ssTx)
        }
      }

      console.log(ssFormatTxs.length)
      console.log('Done...')
    } catch (err) {
      console.log(err)
    }

    offset += 100
  }
  diskCache.offset = offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  console.log('out is: ', out)
  return out
}

module.exports = { doTotle }
