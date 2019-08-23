// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { bns } = require('biggystring')
const { checkSwapService } = require('./checkSwapService.js')

const CACHE_FILE = './cache/brRaw.json'
const MAX_ITERATIONS = 20
let username = ''
let password = ''
if (config.bitrefillCredentials) {
  username = config.bitrefillCredentials.apiKey
  password = config.bitrefillCredentials.apiSecret
}
const headers = {
  Authorization: 'Basic ' + Buffer.from(username + ':' + password).toString('base64')
}

async function doBitrefill (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBitrefill,
    CACHE_FILE,
    'BR',
    swapFuncParams
  )
}

async function fetchBitrefill (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Bitrefill...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  // let offset = diskCache.offset ? diskCache.offset : 0
  // console.log(`Read txs from cache: ${cachedTransactions.length}`)
  const ssFormatTxs: Array<StandardTx> = []

  let url = `https://api.bitrefill.com/v1/orders/`
  let count = 0
  while (1 && !swapFuncParams.useCache) {
    // console.log(`Querying url ${url}`)
    // console.log(`Querying lastTxid ${lastTxid}`)
    // const limit = 100
    const result = await fetch(url, {
      method: 'GET',
      headers
    })
    let txs = []
    let jsonObj = {}
    try {
      jsonObj = await result.json()
      txs = (jsonObj && jsonObj.orders && jsonObj.orders.length) ? jsonObj.orders : []
    } catch (e) {
      console.log('Bitrefill JSON ERROR:', e)
      console.log('url:', url)
      console.log('jsonObj:', jsonObj)
    }
    // console.log(`Bitrefill: count:${count} count:${txs.length}`)

    for (const tx of txs) {
      if (
        tx.paymentReceived === true &&
        tx.expired === false &&
        tx.sent === true
      ) {
        const date = new Date(tx.invoiceTime)
        const timestamp = date.getTime() / 1000

        let inputAmount = 0
        let inputCurrency = 'BTC'
        if (typeof tx.coinCurrency === 'string' && tx.coinCurrency.toUpperCase() !== 'BTC') {
          const inputAmountStr = bns.div(tx.payment.altcoinPrice, '1', 8)
          inputAmount = Number(inputAmountStr)
          inputCurrency = tx.coinCurrency.toUpperCase()
        } else {
          const inputAmountStr = bns.div(tx.satoshiPrice.toString(), '100000000', 8)
          inputAmount = Number(inputAmountStr)
        }
        let inputAddress = ''
        if (tx.payment) {
          inputAddress = tx.payment.address
        }
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.orderId,
          inputAddress,
          inputCurrency,
          inputAmount,
          outputAddress: '',
          outputCurrency: 'USD',
          outputAmount: tx.usdPrice,
          timestamp
        }
        ssFormatTxs.push(ssTx)
      }
    }
    if (count > MAX_ITERATIONS) {
      // console.log('count > 9999')
      break
    }

    // console.log(`Bitrefill completed: ${ssFormatTxs.length}`)
    if (jsonObj.nextUrl) {
      url = jsonObj.nextUrl
    } else {
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

module.exports = { doBitrefill }
