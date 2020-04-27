// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const bns = require('biggystring')
const fs = require('fs')
const { checkSwapService } = require('./checkSwapService.js')
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)

const BITY_CACHE = './cache/bityRaw.json'
const BITY_FOLDER = './cache/bity'
const BITY_TOKEN_URL = 'https://connect.bity.com/oauth2/token'
const BITY_API_URL = 'https://reporting.api.bity.com/exchange/v1/summary/monthly/'

async function doBity (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBity,
    BITY_CACHE,
    'BITY',
    swapFuncParams
  )
}

async function fetchBity (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Bity from JSON...')
  }
  const diskCache = { txs: [] }

  const transactionMap = {}
  const ssFormatTxs: Array<StandardTx> = []

  const files = await fs.readdirSync(BITY_FOLDER)
  // console.log('files: ', files)

  for (const fileName of files) {
    const filePath = `./cache/bity/${fileName}`
    // console.log('filePath is: ', filePath)
    const jsonData = js.readFileSync(filePath)

    if (jsonData.txs.length < 1) {
      break
    }

    for (const order of jsonData.orders) {
      if (!order.input.amount || !order.output.amount || !order.timestamp_executed) {
        continue
      }
      const date = new Date(order.timestamp_executed + 'Z')
      const timestamp = date.getTime() / 1000
      const uniqueIdentifier = `${order.id}`
      const inputAmount = Number(order.input.amount)
      const outputAmount = Number(order.output.amount)
      const ssTx: StandardTx = {
        status: 'complete',
        inputTXID: uniqueIdentifier,
        inputAddress: '',
        inputCurrency: order.input.currency,
        inputAmount,
        outputAddress: '',
        outputCurrency: order.output.currency,
        outputAmount: outputAmount.toString(),
        timestamp: timestamp
      }
      // console.log('ssTx: ', ssTx)
      transactionMap[uniqueIdentifier] = ssTx
    }
  }
  for (const id in transactionMap) {
    ssFormatTxs.push(transactionMap[id])
    ssFormatTxs.sort((a, b) => a.timestamp - b.timestamp)
  }

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

  // Get monthly orders
  const newTransactions = []

  let queryYear = '2019'
  let queryMonth = '9'
  let keepQuerying = true

  while (keepQuerying) {
    console.log(`Date query = ${queryYear}-${queryMonth}`)
    const monthlyResponse = await fetch(`${BITY_API_URL}${queryYear}-${queryMonth}/orders`,
      {
        method: 'GET',
        headers: {Authorization: `Bearer ${authToken}`}
      }
    )
    const monthlyTxs = await monthlyResponse.json()
    // remove this length check 
    // look into pagination
    if (monthlyTxs.length === 0) {
      keepQuerying = false
    }

    if (keepQuerying) {
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

      // Add month to queryMonth
      if (bns.lt(queryMonth, '12')) {
        queryMonth = bns.add(queryMonth, '1')
      } else {
        queryMonth = '1'
        queryYear = bns.add(queryYear, '1')
      }
    }

    // console.log('newTransactions is: ', newTransactions)
  }

  const out = {
    diskCache,
    newTransactions
  }
  return out
}

module.exports = { doBity }
