// @flow
import type {StandardTx, SwapFuncParams} from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const {checkSwapService} = require('./checkSwapService.js')

const CACHE_FILE = './cache/tnkRaw.json'

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
  let offset = diskCache.offset ? diskCache.offset : 0
  const ssFormatTxs: Array<StandardTx> = []

  while (1 && !swapFuncParams.useCache) {
    let limit = 100, orders = []
    const apiResponse = await fetch(`https://api.transak.com/api/v1/partners/orders/?partnerAPISecret=${config.transak_api_secret}?limit=${limit}&skip=${offset}`)
    const ordersData = await apiResponse.json()

    if (ordersData && ordersData.response && orders.response.length) orders = ordersData.response
    else return {}

    for (const order of orders) {
      if (order.status === 'COMPLETE') {
        const ssTx: StandardTx = {
          inputTXID: order.transactionHash,
          inputAddress: order.fromWalletAddress,
          inputCurrency: order.fiatCurrency,
          inputAmount: order.fiatAmount,
          outputAddress: order.walletAddress,
          outputCurrency: order.cryptocurrency,
          status: 'complete',
          timestamp: order.completedAt,
          outputAmount: order.cryptoAmount
        }
        ssFormatTxs.push(ssTx)
      }
    }

    if (orders.length < 100) break
    offset += 100
  }

  diskCache.offset = offset - 500
  const out = {diskCache, newTransactions: ssFormatTxs}
  return out
}

module.exports = {doTransak}
