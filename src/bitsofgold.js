// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const { checkSwapService } = require('./checkSwapService.js')

const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const CACHE_FILE = './cache/bogRaw.json'
const isConfigValid = (typeof config.bog !== 'undefined' && config.bog.apiKey !== 'undefined')

let BITS_OF_GOLD_API_KEY
if (isConfigValid) {
  BITS_OF_GOLD_API_KEY = config.bog.apiKey
}

async function doBog (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBog,
    CACHE_FILE,
    'BOG',
    swapFuncParams
  )
}

async function fetchBog (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Bits of Gold...')
  }
  let diskCache = { txs: [], offset: new Date('2019-01-01') }

  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {}
  const startTimestamp = diskCache.offset
  const endTimestamp = Date.now()
  const safeStartTimestamp = startTimestamp - 7 * 24 * 60 * 60
  const safeEndTimestamp = endTimestamp - 24 * 60 * 60
  const startDate = new Date(safeStartTimestamp)
  const endDate = new Date(safeEndTimestamp)
  const startDayOfMonth = startDate.getDate()
  const endDayOfMonth = endDate.getDate()
  const formattedStartDate = `${startDayOfMonth}-${startDate.getMonth() + 1}-${startDate.getFullYear()}`
  const formattedEndDate = `${endDayOfMonth}-${endDate.getMonth() + 1}-${endDate.getFullYear()}`
  const standardFormatTxs: Array<StandardTx> = []

  if (!swapFuncParams.useCache && isConfigValid) {
    const url = `http://webapi.bitsofgold.co.il/v1/sells/by_provider/?provider=${BITS_OF_GOLD_API_KEY}&filter%5Bcreated_at_gteq%5D=%27${formattedStartDate}%27&filter%5Bcreated_at_lt%5D=%27${formattedEndDate}`
    const result = await fetch(url, {
      method: 'GET'
    })
    const txs = await result.json()

    for (const tx of txs.data) {
      const data = tx.attributes
      const date = new Date(data.timestamp)
      const timestamp = date.getTime() / 1000

      const standardTx: StandardTx = {
        status: 'complete',
        inputTXID: tx.id,
        inputAddress: '',
        inputCurrency: data.coin_type,
        inputAmount: data.coin_amount,
        outputAddress: '',
        outputCurrency: data.fiat_type,
        outputAmount: data.fiat_amount,
        timestamp
      }
      standardFormatTxs.push(standardTx)
    }
  }

  diskCache.offset = endDate.setDate(endDate.getDate() - 7)
  const out = {
    diskCache,
    newTransactions: standardFormatTxs
  }
  return out
}

module.exports = { doBog }
