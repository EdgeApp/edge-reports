// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const confFileName = './config.json'
const CONFIG = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')
const axios = require('axios')

const SIMPLEX_CACHE = './cache/simRaw.json'

async function doSimplex (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchSimplex,
    SIMPLEX_CACHE,
    'SIM',
    swapFuncParams
  )
}

async function fetchSimplex (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Simplex...')
  }
  let diskCache = { txs: [], offset: 0 }

  const transactionMap = {}
  const ssFormatTxs: Array<StandardTx> = []

  try {
    diskCache = js.readFileSync(SIMPLEX_CACHE)
    // console.log('diskCache: ', diskCache)
  } catch (e) {}

  // flag for fresh vs already-populated cache
  const initialOffset = diskCache.offset || 0
  let offset = diskCache.offset || 0
  let minTimestamp = initialOffset ? (initialOffset - 10) : 0
  let maxTimestamp = 0
  let offsetSyntax = ``

  try {
    while (1 && !swapFuncParams.useCache) {
      // console.log('----------------')
      // console.log('initialOffset: ', initialOffset)
      // console.log('offset: ', offset)
      // console.log('maxTimestamp: ', maxTimestamp)
      // console.log('minTimestamp: ', minTimestamp)
      if (initialOffset) { // if continuing
        offsetSyntax = `starting_at=${maxTimestamp}&`
      } else { // if from fresh / empty tx set
        if (offset === 0) { // if first time in loop
          offsetSyntax = ''
        } else { // otherwise
          offsetSyntax = `ending_at=${minTimestamp}&`
        }
      }
      const url = `https://turnkey.api.simplex.com/transactions?${offsetSyntax}limit=1000`
      console.log('url: ', url)
      const csvData = await axios({
        url,
        headers: {
          'X-API-KEY': CONFIG.simplex.apiKey
        }
      })

      const responseTxs = csvData.data.data

      for (const order of responseTxs) {
        if (!order.fiat_total_amount || !order.amount_crypto) {
          continue
        }
        const timestamp = order.created_at
        const uniqueIdentifier = order.transaction_id
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: uniqueIdentifier,
          inputAddress: '',
          inputCurrency: order.currency,
          inputAmount: parseFloat(order.fiat_total_amount.replace('$', '').replace(',', '')),
          outputAddress: '',
          outputCurrency: order.crypto_currency,
          outputAmount: order.amount_crypto,
          timestamp: timestamp
        }
        // 1567388220 = first transaction
        // console.log('timestamp: ', timestamp)
        // if not fetching from scratch
        if (initialOffset) {
          // then update minimum if timestamp lower than minimum
          if (timestamp < minTimestamp) minTimestamp = timestamp
        }
        // if it's from scratch and this is first tx
        // then set the minimum timestamp to current tx
        if (!initialOffset) minTimestamp = timestamp
        // if timestamp is greater than max
        // then set new max to current tx
        if (timestamp > maxTimestamp) maxTimestamp = timestamp
        offset = maxTimestamp
        // console.log('ssTx: ', ssTx)
        transactionMap[uniqueIdentifier] = ssTx
      }
      if (responseTxs.length < 1000) {
        console.log('responseTxs.length: ', responseTxs.length)
        // set the offset for the cache to
        diskCache.offset = offset
        break
      }
    }
  } catch (error) {
    console.log('error: ', error)
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
