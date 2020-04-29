// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const bns = require('biggystring')
const { checkSwapService } = require('./checkSwapService.js')
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)

const BITY_CACHE = './cache/bityRaw.json'
const BITY_TOKEN_URL = 'https://connect.bity.com/oauth2/token'
const BITY_API_URL = 'https://reporting.api.bity.com/exchange/v1/summary/monthly/'

async function doBity (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBity,
    BITY_CACHE,
    'BITY',
    swapFuncParams
  )
}

let queryYear = '2020'
let queryMonth = '1'
const todayMonth = bns.add(new Date().getMonth().toString(), '1')
const todayYear = new Date().getFullYear().toString()

async function fetchBity (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Bity from JSON...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(BITY_CACHE)
    // First tx in diskCache is the most recent
    queryMonth = new Date(diskCache.txs[0].timestamp * 1000).getMonth().toString()
    queryYear = new Date(diskCache.txs[0].timestamp * 1000).getFullYear().toString()
  } catch (e) {}

  // Get auth token
  const credentials = {
    'grant_type': 'client_credentials',
    scope: 'https://auth.bity.com/scopes/reporting.exchange',
    client_id: config.bity.clientId,
    client_secret: config.bity.clientSecret
  }

  const tokenParams = Object.keys(credentials).map((key) => {
    return encodeURIComponent(key) + '=' + encodeURIComponent(credentials[key])
  }).join('&')

  const tokenResponse = await fetch(BITY_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: tokenParams
  })
  const tokenReply = await tokenResponse.json()
  const authToken = tokenReply.access_token

  // Query monthly orders
  const newTransactions = []

  let keepQuerying = true
  let page = 1

  while (keepQuerying) {
    const monthlyResponse = await fetch(`${BITY_API_URL}${queryYear}-${queryMonth}/orders?page=${page}`,
      {
        method: 'GET',
        headers: {Authorization: `Bearer ${authToken}`}
      }
    )
    const monthlyTxs = await monthlyResponse.json()

    for (const tx of monthlyTxs) {
      const date = new Date(tx.timestamp_executed)
      const timestamp = date.getTime() / 1000

      const ssTx: StandardTx = {
        status: 'complete',
        inputTXID: '',
        inputAddress: '',
        inputCurrency: tx.input.currency.toUpperCase(),
        inputAmount: tx.input.amount,
        outputAddress: '',
        outputCurrency: tx.output.currency.toUpperCase(),
        outputAmount: tx.output.amount.toString(),
        timestamp
      }
      newTransactions.push(ssTx)
    }

    if (monthlyTxs.length < 100 && queryMonth === todayMonth && queryYear === todayYear) {
      keepQuerying = false
    } else if (monthlyTxs.length === 100) {
      page += 1
    } else {
      page = 1
      if (bns.lt(queryMonth, '12')) {
        queryMonth = bns.add(queryMonth, '1')
      } else {
        queryMonth = '1'
        queryYear = bns.add(queryYear, '1')
      }
    }
  }

  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doBity }
