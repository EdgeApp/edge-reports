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
  let maxTimestamp = diskCache.offset || 0
  let continueFromSyntax = ''
  let has_more_pages = false
  let next_page_cursor = ''

  try {
    while (1 && !swapFuncParams.useCache) {
      // console.log('----------------')
      // console.log('initialOffset: ', initialOffset)
      // console.log('offset: ', offset)
      // console.log('maxTimestamp: ', maxTimestamp)
      // console.log('minTimestamp: ', minTimestamp)
      if (next_page_cursor) continueFromSyntax = `continue_from=${next_page_cursor}&`
      const url = `https://turnkey.api.simplex.com/transactions?${continueFromSyntax}limit=1000`
      console.log('url: ', url)
      const csvData = await axios({
        url,
        headers: {
          'X-API-KEY': CONFIG.simplex.apiKey
        }
      })

      has_more_pages = csvData.data.has_more_pages
      next_page_cursor = csvData.data.next_page_cursor

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

        if (timestamp > maxTimestamp) maxTimestamp = timestamp

        transactionMap[uniqueIdentifier] = ssTx

        // if transaction is before the cutoff timestamp
        // then stop the loop

        if (timestamp < initialOffset) {
          has_more_pages = false
        }
      }
      if (has_more_pages === false) {
        console.log('responseTxs.length: ', responseTxs.length)
        // set the offset for the cache to two weeks before latest tx
        diskCache.offset = maxTimestamp - 60 * 60 * 24 * 14
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
