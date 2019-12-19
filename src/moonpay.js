// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CACHE_FILE = './cache/mnpRaw.json'
const MAX_ITERATIONS = 20
const PER_REQUEST_LIMIT = 50

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

  const currenciesUrl = 'https://api.moonpay.io/v2/currencies'
  const currenciesResult = await fetch(currenciesUrl)
  const currencies = await currenciesResult.json()

  let count = 0
  while (1 && !swapFuncParams.useCache) {
    const offset = count * PER_REQUEST_LIMIT
    const url = `https://api.moonpay.io/v1/transactions?limit=${PER_REQUEST_LIMIT}&offset=${offset}`
    const result = await fetch(url, {
      method: 'GET',
      headers
    })
    const txs = await result.json()
    // console.log(`Moonpay: offset:${offset} count:${txs.length}`)

    for (const tx of txs) {
      if (tx.status === 'completed') {
        const baseCurrency = currencies.find(cur => cur.id === tx.baseCurrencyId)
        const baseCurrencyCode = baseCurrency && baseCurrency.code && baseCurrency.code.toUpperCase()
        const outputCurrency = currencies.find(cur => cur.id === tx.currencyId)
        const outputCurrencyCode = outputCurrency && outputCurrency.code && outputCurrency.code.toUpperCase()
        if (!baseCurrencyCode) {
          console.warn(`baseCurrencyCode not defined for Moonpay tx ID: ${tx.id}`)
        }
        if (!outputCurrencyCode) {
          console.warn(`outputCurrencyCode not defined for Moonpay tx ID: ${tx.id}`)
        }
        if (baseCurrencyCode && outputCurrencyCode) {
          const date = new Date(tx.createdAt)
          const timestamp = date.getTime() / 1000

          const ssTx: StandardTx = {
            status: 'complete',
            inputTXID: tx.cryptoTransactionId,
            inputAddress: '',
            inputCurrency: baseCurrencyCode,
            inputAmount: tx.baseCurrencyAmount,
            outputAddress: tx.walletAddress,
            outputCurrency: outputCurrencyCode,
            outputAmount: tx.quoteCurrencyAmount,
            timestamp
          }
          ssFormatTxs.push(ssTx)
        }
      }
    }
    if (count > MAX_ITERATIONS || txs.length === 0) {
      break
    }
    count++
  }

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doMoonpay }
