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
  Authorization:
    'Basic ' + Buffer.from(username + ':' + password).toString('base64')
}

async function doBitrefill (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBitrefill, CACHE_FILE, 'BR', swapFuncParams)
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
    let jsonObj
    let txs
    try {
      jsonObj = await result.json()
      txs =
        jsonObj && jsonObj.orders && jsonObj.orders.length ? jsonObj.orders : []
      // console.log(`Bitrefill: count:${count} count:${txs.length}`)
    } catch (e) {
      console.log(e)
      break
    }

    for (const tx of txs) {
      if (
        tx.paymentReceived === true &&
        tx.expired === false &&
        tx.sent === true
      ) {
        const date = new Date(tx.invoiceTime)
        const timestamp = date.getTime() / 1000

        let inputAmount = tx.satoshiPrice
        const inputCurrency = tx.coinCurrency.toUpperCase()
        const div = {
          BTC: '100000000',
          ETH: '1000000',
          LTC: '100000000',
          DASH: '100000000',
          DOGE: '100000000'
        }
        if (!div[inputCurrency]) {
          console.log(inputCurrency + ' has no div')
          break
        }
        if (
          typeof inputCurrency === 'string' &&
          inputCurrency !== 'BTC'
        ) {
          inputAmount = tx.receivedPaymentAltcoin
        }
        const inputAmountStr = bns.div(inputAmount.toString(), div[inputCurrency].toString(), 8)
        inputAmount = Number(inputAmountStr)

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
          outputAmount: tx.usdPrice.toString(),
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
