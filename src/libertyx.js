// @flow

import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const LIBERTYX_CACHE = './cache/libertyxRaw.json'

async function doLibertyX (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchLibertyX,
    LIBERTYX_CACHE,
    'LX',
    swapFuncParams
  )
}

async function fetchLibertyX (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Libertyx...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(LIBERTYX_CACHE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  // console.log(`Read txs from cache: ${cachedTransactions.length}`)
  const newTransactions = []

  if (!swapFuncParams.useCache) {
    // console.log(`Querying libertyx...`)
    const apiKey = config.libertyXApiKey
    const request = `https://libertyx.com/airbitz/stats`
    // console.log(request)
    let response
    try {
      response = await fetch(request, {
        headers: {
          Authorization: `${apiKey}`
        },
        method: 'POST'
      })
      const result = await response.json()
      for (const tx of result.stats) {
        if (!tx.all_transactions_usd_sum) {
          continue
        }
        const date = new Date(tx.date_us_eastern)
        const timestamp = date.getTime() / 1000
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.date_us_eastern,
          inputAddress: '',
          inputCurrency: 'USD',
          inputAmount: tx.all_transactions_usd_sum,
          outputAddress: '',
          outputCurrency: 'USD',
          outputAmount: tx.all_transactions_usd_sum.toString(),
          timestamp
        }
        newTransactions.push(ssTx)
      }
    } catch (e) {
      console.log(e)
      return
    }
  }

  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doLibertyX }
