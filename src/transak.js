// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CACHE_FILE = './cache/tnkRaw.json'

const isConfigValid = (typeof config.transak_api_secret !== 'undefined')

let query = ''
if (isConfigValid) {
  query = config.transak_api_secret
}

async function doTransak (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchTransak,
    CACHE_FILE,
    'TNK',
    swapFuncParams
  )
}

async function fetchTransak (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Transak...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CACHE_FILE)
  } catch (e) {}

  const ssFormatTxs: Array<StandardTx> = []

  const url = `https://api.transak.com/api/v1/partners/orders/?partnerAPISecret=${query}`
  const result = await fetch(url, {
    method: 'GET'
  })
  const orders = await result.json()
  if(!orders && !orders.response){
    throw new Error('Orders fetching failed for Transak')
  }
  
  for (const order of orders.response) {
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

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doTransak }
