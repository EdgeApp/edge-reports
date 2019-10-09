// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CHANGENOW_CACHE = './cache/cnRaw.json'

const CURRENCY_CODE_TRANSCRIPTION = {
  // exchangeCurrencyCode: edgeCurrencyCode
  // should be opposite / mirror of exchage-plugins
  'USDTERC20': 'USDT'
}

async function doChangenow (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchChangenow,
    CHANGENOW_CACHE,
    'CN',
    swapFuncParams
  )
}

async function fetchChangenow (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Changenow...')
  }
  let diskCache = { offset: 0, txs: [] }
  try {
    diskCache = js.readFileSync(CHANGENOW_CACHE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  let offset = diskCache.offset ? diskCache.offset : 0
  // console.log(`Read txs from cache: ${cachedTransactions.length} offset:${offset}`)
  const ssFormatTxs: Array<StandardTx> = []

  while (1 && !swapFuncParams.useCache) {
    // console.log(`Querying offset ${offset}`)
    const limit = 100
    const result = await fetch(`https://changenow.io/api/v1/transactions/${config.changenowApiKey}?limit=${limit}&offset=${offset}`)
    const txs = await result.json()
    console.log(`Changenow: offset:${offset} count:${txs.length}`)
    if (!txs.length) {
      return {}
    }

    for (const tx of txs) {
      if (tx.status === 'finished') {
        const date = new Date(tx.updatedAt)
        const timestamp = date.getTime() / 1000
        let inputCurrency = tx.fromCurrency.toUpperCase()
        let outputCurrency = tx.toCurrency.toUpperCase()
        if (CURRENCY_CODE_TRANSCRIPTION[inputCurrency]) {
          console.log('translating ', inputCurrency, ' to ', CURRENCY_CODE_TRANSCRIPTION[inputCurrency])
          inputCurrency = CURRENCY_CODE_TRANSCRIPTION[inputCurrency]
        }
        if (CURRENCY_CODE_TRANSCRIPTION[outputCurrency]) {
          console.log('translating ', outputCurrency, ' to ', CURRENCY_CODE_TRANSCRIPTION[outputCurrency])
          outputCurrency = CURRENCY_CODE_TRANSCRIPTION[outputCurrency]
        }

        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.payinHash,
          inputAddress: tx.payinAddress,
          inputCurrency,
          inputAmount: tx.amountSend,
          outputAddress: tx.payoutAddress,
          outputCurrency,
          outputAmount: tx.amountReceive.toString(),
          timestamp
        }
        ssFormatTxs.push(ssTx)
      }
    }
    if (txs.length < 100) {
      // console.log('length < 100, stopping query')
      break
    }

    // console.log(`Changenow completed: ${ssFormatTxs.length}`)
    offset += 100
  }
  diskCache.offset = offset - 500
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doChangenow }
