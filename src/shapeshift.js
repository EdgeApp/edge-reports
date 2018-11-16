// @flow

import type { SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const SS_QUERY_HISTORY = 300
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const SHAPESHIFT_CACHE = './ssRaw.json'

async function doShapeShift (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchShapeShift,
    SHAPESHIFT_CACHE,
    'SS',
    swapFuncParams
  )
}

async function fetchShapeShift (swapFuncParams: SwapFuncParams) {
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(SHAPESHIFT_CACHE)
  } catch (e) {}
  const cachedTransactions = diskCache.txs
  console.log(`Read txs from cache: ${cachedTransactions.length}`)
  let newTransactions = []

  if (!swapFuncParams.useCache) {
    console.log(`Querying shapeshift...`)
    const apiKey = config.shapeShiftApiKey
    try {
      const request = `https://shapeshift.io/txbyapikeylimit/${apiKey}/${SS_QUERY_HISTORY}`
      //   if (!doSummary) {
      //     console.log(request)
      //   }
      const response = await fetch(request)
      newTransactions = await response.json()
    } catch (e) {
      newTransactions = []
    }
  }
  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doShapeShift }
