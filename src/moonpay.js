// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CACHE_FILE = './cache/mnpRaw.json'
const MAX_ITERATIONS = 20
const LIMIT = 100

const isConfigValid = (typeof config.moonpayApiKey !== 'undefined')

let headers = {}
if (isConfigValid) {
  headers = {
    Authorization: `Api-Key ${config.moonpayApiKey}`
  }
}

async function doMoonpay (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchMoonpay,
    CACHE_FILE,
    'MNP',
    swapFuncParams
  )
}

async function fetchMoonpay (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Moonpay...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {}

  const ssFormatTxs: Array<StandardTx> = []

  let count = 0
  while (1 && !swapFuncParams.useCache) {
    const offset = count * LIMIT
    const url = `https://api.moonpay.io/v2/transactions?limit=${LIMIT}&offset=${offset}`
    const result = await fetch(url, {
      method: 'GET',
      headers
    })
    const txs = await result.json()
    console.log(`Moonpay: offset:${offset} count:${txs.length}`)

    for (const tx of txs) {
      if (tx.status === 'completed') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.cryptoTransactionId,
          inputAddress: '',
          inputCurrency: tx.baseCurrencyId.toUpperCase(),
          inputAmount: tx.baseCurrencyAmount,
          outputAddress: tx.walletAddress,
          outputCurrency: tx.currencyId.toUpperCase(),
          outputAmount: tx.quoteCurrencyAmount,
          timestamp: tx.createdAt
        }
        ssFormatTxs.push(ssTx)
      }
    }
    if (count > MAX_ITERATIONS) {
      // console.log('count > 9999')
      break
    }
    count++
  }
  // diskCache.offset = offset > 600 ? offset - 600 : offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doMoonpay, isConfigValid }
