// @flow
import type {StandardTx, SwapFuncParams} from './checkSwapService.js'

const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const {checkSwapService} = require('./checkSwapService.js')

const GODEX_CACHE = './cache/gxRaw.json'
const apiKey = config.godex.apiKey
const headers = {
  'Authorization': `Bearer ${apiKey}`,
  'Access-Control-Allow-Credentials': true
}
async function doGodex (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchGodex,
    GODEX_CACHE,
    'GX',
    swapFuncParams
  )
}

async function fetchGodex (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Godex...')
  }
  let diskCache = {txs: []}
  try {
    diskCache = js.readFileSync(GODEX_CACHE)
  } catch (e) {
  }

  const ssFormatTxs: Array<StandardTx> = []
  let offset = diskCache.offset ? diskCache.offset : 0
  while (1 && !swapFuncParams.useCache) {
    const limit = 100
    const url = `https://api.godex.io/api/v1/affiliate/history?limit=${limit}&offset=${offset}`
    const result = await fetch(url, {
      method: 'GET',
      headers
    })
    console.log('apiKey: ', apiKey)
    console.log('URL is: ', url)
    const jsonObj = await result.json()
    console.log('jsonObj: ', jsonObj)

    const txs = (jsonObj && jsonObj.length) ? jsonObj : []
    // console.log('txs')
    // console.log(txs)
    for (const tx of txs) {
      // console.log('tx')
      // console.log(tx)
      if (tx.status === 'success') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.hash_in,
          inputAddress: tx.deposit,
          inputCurrency: tx.coin_from.toUpperCase(),
          inputAmount: tx.deposit_amount,
          outputAddress: tx.withdrawal,
          outputCurrency: tx.coin_to.toUpperCase(),
          outputAmount: tx.withdrawal_amount,
          timestamp: tx.created_at
        }
        ssFormatTxs.push(ssTx)
      }
    }
    // console.log('ssFormatTxs')
    // console.log(ssFormatTxs)

    if (txs.length < 100) {
      break
    }

    // console.log(`Godex completed: ${ssFormatTxs.length}`)
    offset += 100
  }
  diskCache.offset = offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

// console.log(doGodex({useCache: false, interval: 'month', endDate: '2019-05'}))
module.exports = {doGodex}
