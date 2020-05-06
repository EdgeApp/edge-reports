// @flow

import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const SS_QUERY_PAGES = 3
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const FILE_CACHE = './cache/switchainRaw.json'
const PAGE_LIMIT = 100

async function doSwitchain (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchSwitchain, FILE_CACHE, 'SWI', swapFuncParams)
}

async function fetchSwitchain (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Switchain...')
  }

  let diskCache = { txs: [], queryAll: true }
  try {
    diskCache = js.readFileSync(FILE_CACHE)
  } catch (e) {}

  const newTransactions = []
  let page = 1

  while (1 && !swapFuncParams.useCache) {
    try {
      const request = `https://api.switchain.com/rest/v1/ordersinfo?limit=${PAGE_LIMIT}&page=${page}`
      const options = {
        method: 'GET',
        headers: {
          'authorization': `Bearer ${config.switchainApiKey}`
        }
      }
      const response = await fetch(request, options)
      const result = await response.json()
      const txs = result.orders
      for (const tx of txs) {
        if (tx.status === 'confirmed' && tx.appId === config.switchainApiKey) {
          const date = new Date(tx.createdAt)
          const timestamp = date.getTime() / 1000
          const pair = tx.pair.split('-')

          const ssTx: StandardTx = {
            status: 'complete',
            inputTXID: tx.depositTxId,
            inputAddress: tx.depositAddress,
            inputCurrency: pair[0].toUpperCase(),
            inputAmount: parseFloat(tx.amountFrom),
            outputAddress: tx.withdrawAddress,
            outputCurrency: pair[1].toUpperCase(),
            outputAmount: tx.rate,
            timestamp
          }
          newTransactions.push(ssTx)
        }
      }

      if (txs.length < PAGE_LIMIT) {
        break
      }
    } catch (e) {
      break
    }
    page++
    if (page > SS_QUERY_PAGES && !diskCache.queryAll) {
      break
    }
  }

  diskCache.queryAll = false
  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doSwitchain }
