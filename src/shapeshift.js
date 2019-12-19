// @flow

import type { SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const SS_QUERY_PAGES = 2
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const SHAPESHIFT_CACHE = './cache/ssRaw.json'

async function doShapeShift (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchShapeShift,
    SHAPESHIFT_CACHE,
    'SS',
    swapFuncParams
  )
}

async function fetchShapeShift (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Shapeshift...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(SHAPESHIFT_CACHE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  // console.log(`Read txs from cache: ${cachedTransactions.length}`)
  let newTransactions = []
  let page = 0

  while (1 && !swapFuncParams.useCache) {
    // console.log(`Querying shapeshift... page ${page}`)
    try {
      const request = `https://shapeshift.io/client/transactions?limit=500&sort=DESC&page=${page}`
      const options = {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${config.shapeShiftToken}`
        }
      }
      //   if (!doSummary) {
      //     console.log(request)
      //   }
      const response = await fetch(request, options)
      const txs = await response.json()
      newTransactions = newTransactions.concat(txs)
      if (txs.length < 500) {
        break
      }
    } catch (e) {
      break
    }
    page++
    if (page > SS_QUERY_PAGES) {
      break
    }
  }
  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doShapeShift }
