// @flow
import type {StandardTx, SwapFuncParams} from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const {checkSwapService} = require('./checkSwapService.js')

const CACHE_FILE = './cache/ptRaw.json'
const pageLimit = 100

async function doPaytrie (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchPaytrie,
    CACHE_FILE,
    'PT',
    swapFuncParams
  )
}

async function fetchPaytrie (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) console.log('Fetching Paytrie...')
  let diskCache = {offset: '2020-01-01', txs: []}
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {
  }
  const ssFormatTxs: Array<StandardTx> = []
  const startDate = diskCache.offset || '2020-01-01'
  const endDate = new Date().toISOString().slice(0,10);

  while (1 && !swapFuncParams.useCache) {
    const apiResponse = await fetch(`https://api4.paytrie.com/getEdgeTransactions?startDate=${startDate}&endDate=${endDate}`, {
      headers: {
        'x-api-key': config.paytrieCredentials.apiKey,
        'Authorization': 'Bearer ' + config.paytrieCredentials.secretToken,
      },
      method: 'post',
    }).catch(err => console.error(err));

    const orders = await apiResponse.json()

    if(orders && orders.length > 1) {
      for (const order of orders) {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: order.inputTXID,
          inputAddress: order.inputAddress,
          inputCurrency: order.inputCurrency,
          inputAmount: order.inputAmount,
          outputAddress: order.outputAddress,
          outputCurrency: order.outputCurrency,
          outputAmount: order.outputAmount.toString(),
          timestamp: new Date(order.timestamp).getTime() / 1000
        }
        ssFormatTxs.push(ssTx)
      }
    } else return {}
    break
  }

  diskCache.offset = endDate
  const out = {diskCache, newTransactions: ssFormatTxs}
  return out
}

module.exports = {doPaytrie}
