// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CHANGENOW_CACHE = './cache/cnRaw.json'

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
    const result = await fetch(`https://changenow.io//api/v1/transactions/${config.changenowApiKey}?limit=${limit}&offset=${offset}`)
    const txs = await result.json()
    // console.log(`Changenow: offset:${offset} count:${txs.length}`)

    for (const tx of txs) {
      if (tx.status === 'finished') {
        const date = new Date(tx.updatedAt)
        const timestamp = date.getTime() / 1000

        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.payinHash,
          inputAddress: tx.payinAddress,
          inputCurrency: tx.fromCurrency.toUpperCase(),
          inputAmount: tx.amountSend,
          outputAddress: tx.payoutAddress,
          outputCurrency: tx.toCurrency.toUpperCase(),
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
  diskCache.offset = offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doChangenow }
