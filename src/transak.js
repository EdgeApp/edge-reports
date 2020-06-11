// @flow
import type {StandardTx, SwapFuncParams} from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const {checkSwapService} = require('./checkSwapService.js')

const CACHE_FILE = './cache/tnkRaw.json'
const pageLimit = 100

async function doTransak (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchTransak,
    CACHE_FILE,
    'TNK',
    swapFuncParams
  )
}

async function fetchTransak (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) console.log('Fetching Transak...')
  let diskCache = {offset: 0, txs: []}
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {
  }
  let offset = diskCache.offset >= 0 ? diskCache.offset : 0
  const ssFormatTxs: Array<StandardTx> = []

  while (1 && !swapFuncParams.useCache) {
    let orders = []

    const apiResponse = await fetch(`https://api.transak.com/api/v1/partners/orders/?partnerAPISecret=${config.transak_api_secret}&limit=${pageLimit}&skip=${offset}`)
    const ordersData = await apiResponse.json()

    if (ordersData && ordersData.response && ordersData.response.length) orders = ordersData.response
    else return {}

    for (const order of orders) {
      if (order.status === 'COMPLETED') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: order.id,
          inputAddress: order.fromWalletAddress,
          inputCurrency: order.fiatCurrency,
          inputAmount: order.fiatAmount,
          outputAddress: order.walletAddress,
          outputCurrency: order.cryptocurrency,
          outputAmount: order.cryptoAmount.toString(),
          timestamp: new Date(order.completedAt).getTime() / 1000
        }
        ssFormatTxs.push(ssTx)
      }
    }

    if (orders.length < pageLimit) break
    offset += pageLimit
  }

  diskCache.offset = offset - 500
  const out = {diskCache, newTransactions: ssFormatTxs}
  return out
}

module.exports = {doTransak}
