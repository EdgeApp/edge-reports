// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const COINSWITCH_CACHE = './cache/csRaw.json'

async function doCoinswitch (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchCoinswitch,
    COINSWITCH_CACHE,
    'CS',
    swapFuncParams
  )
}

async function fetchCoinswitch (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Coinswitch...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(COINSWITCH_CACHE)
  } catch (e) {}
  const ssFormatTxs: Array<StandardTx> = []
  let start = 0
  const count = 25
  while (1 && !swapFuncParams.useCache) {
    try {
      const url = `https://api.coinswitch.co/v2/orders?start=${start}&count=${count}&status=complete`
      const headers = {
        'x-api-key': config.coinswitch.apiKey
      }
      const response = await fetch(url, {method: 'GET', headers: headers})
      const txs = await response.json()
      // console.log(`Coinswitch: start:${start} count:${txs.data.items.length}`)

      for (const tx of txs.data.items) {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.inputTransactionHash,
          inputAddress: tx.exchangeAddress.address,
          inputCurrency: tx.depositCoin.toUpperCase(),
          inputAmount: tx.depositCoinAmount,
          outputAddress: tx.destinationAddress.address,
          outputCurrency: tx.destinationCoin.toUpperCase(),
          outputAmount: tx.destinationCoinAmount.toString(),
          timestamp: Math.floor(tx.createdAt / 1000)
        }
        ssFormatTxs.push(ssTx)
      }

      if (start > 100) {
        break
      }
      if (txs.length < 25) {
        break
      }
    } catch (e) {
      break
    }
    start += count
  }

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doCoinswitch }
