// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const { checkSwapService } = require('./checkSwapService.js')

const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const CACHE_FILE = './cache/wyrRaw.json'
const isConfigValid = (typeof config.wyre !== 'undefined' && config.wyre.periscopeClientKey !== 'undefined')

let WYRE_PERSICOPE_CLIENT_KEY
if (isConfigValid) {
  WYRE_PERSICOPE_CLIENT_KEY = config.wyre.periscopeClientKey
}

async function doWyre (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchWyre,
    CACHE_FILE,
    'WYR',
    swapFuncParams
  )
}

function parseTxStr (txStr) {
  const txItems = txStr.split(',')
  return {
    id: txItems[0],
    owner: txItems[1],
    status: txItems[2],
    createdAt: txItems[3],
    completedAt: txItems[4],
    sourceAmount: txItems[5],
    sourceCurrency: txItems[6],
    destAmount: txItems[7],
    destCurrency: txItems[8],
    failureReason: txItems[9]
  }
}

async function fetchWyre (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Wyre...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {}

  const ssFormatTxs: Array<StandardTx> = []

  if (!swapFuncParams.useCache && isConfigValid) {
    const url = `https://app.periscopedata.com/api/sendwyre/chart/csv/${WYRE_PERSICOPE_CLIENT_KEY}`
    const result = await fetch(url, {
      method: 'GET'
    })
    const csvResults = await result.text()
    const txs = csvResults.split('\n')
    txs.shift()

    for (const txStr of txs) {
      const tx = parseTxStr(txStr)
      if (
        tx.status === 'COMPLETED' &&
        tx.sourceCurrency !== tx.destCurrency
      ) {
        const date = new Date(tx.createdAt)
        const timestamp = date.getTime() / 1000

        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.id,
          inputAddress: '',
          inputCurrency: tx.sourceCurrency,
          inputAmount: tx.sourceAmount,
          outputAddress: '',
          outputCurrency: tx.destCurrency,
          outputAmount: tx.destAmount,
          timestamp
        }
        ssFormatTxs.push(ssTx)
      }
    }
  }

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doWyre }
