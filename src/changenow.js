// @flow
import type { ShapeShiftTx, SwapFuncParams } from './checkSwapService.js'
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
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CHANGENOW_CACHE)
  } catch (e) {}
  const cachedTransactions = diskCache.txs
  console.log(`Read txs from cache: ${cachedTransactions.length}`)
  // let offset = diskCache.offset ? diskCache.offset : 0
  let offset = 0
  const ssFormatTxs: Array<ShapeShiftTx> = []

  while (1 && !swapFuncParams.useCache) {
    console.log(`Querying offset ${offset}`)
    const limit = 100
    const result = await fetch(`https://changenow.io//api/v1/transactions/${config.changenowApiKey}?limit=${limit}&offset=${offset}`)
    const txs = await result.json()
    console.log(`Changenow: offset:${offset} count:${txs.length}`)

    for (const tx of txs) {
      if (tx.status === 'finished') {
        const date = new Date(tx.updatedAt)
        const timestamp = date.getTime() / 1000

        const ssTx: ShapeShiftTx = {
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
      console.log('length < 100, stopping query')
      break
    }

    console.log(`Changenow completed: ${ssFormatTxs.length}`)
    // if (offset > 300) {
    //   console.log('length < 100, stopping query')
    //   break
    // }
    offset += 100
    // break
  }
  // diskCache.offset = offset > 600 ? offset - 600 : offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doChangenow }
