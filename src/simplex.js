// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fs = require('fs')
const { checkSwapService } = require('./checkSwapService.js')
const csv = require('csvtojson')

const SIMPLEX_CACHE = './cache/simRaw.json'
const SIMPLEX_FOLDER = './cache/simplex'

async function doSimplex (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchSimplex,
    SIMPLEX_CACHE,
    'SIM',
    swapFuncParams
  )
}

async function fetchSimplex (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Simplex from CSV...')
  }
  let diskCache = { txs: [] }

  const transactionMap = {}
  const ssFormatTxs: Array<StandardTx> = []

  try {
    diskCache = js.readFileSync(SIMPLEX_CACHE)
  } catch (e) {}

  const files = await fs.readdirSync(SIMPLEX_FOLDER)
  // console.log('files: ', files)

  for (const fileName of files) {
    const filePath = `./cache/simplex/${fileName}`
    // console.log('filePath is: ', filePath)
    const csvData = await csv().fromFile(filePath)

    for (const order of csvData) {
      if (!order.total_amount_usd || !order.total_amount_crypto) {
        continue
      }
      const date = new Date(order.processed_at_utc)
      const timestamp = date.getTime() / 1000
      const uniqueIdentifier = `${timestamp}-${order.total_amount_crypto.replace('.', '')}`
      const ssTx: StandardTx = {
        status: 'complete',
        inputTXID: uniqueIdentifier,
        inputAddress: '',
        inputCurrency: order.currency,
        inputAmount: parseFloat(order.total_amount_usd.replace('$', '').replace(',', '')),
        outputAddress: '',
        outputCurrency: order.crypto_currency,
        outputAmount: order.total_amount_crypto,
        timestamp: timestamp
      }
      // console.log('ssTx: ', ssTx)
      transactionMap[uniqueIdentifier] = ssTx
    }
  }
  for (const id in transactionMap) {
    ssFormatTxs.push(transactionMap[id])
    ssFormatTxs.sort((a, b) => a.timestamp - b.timestamp)
  }

  // console.log('ssFormatTxs is: ', ssFormatTxs)

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doSimplex }
