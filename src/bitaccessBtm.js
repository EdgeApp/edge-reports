// @flow

import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const crypto = require('crypto')
const fetch = require('node-fetch')
const SS_QUERY_PAGES = 3
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const FILE_CACHE = './cache/btmRaw.json'
const PAGE_LIMIT = 50

async function doBitaccessBtm (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBitaccessBtm, FILE_CACHE, 'BTM', swapFuncParams)
}

async function fetchBitaccessBtm (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Bitaccess BTM...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(FILE_CACHE)
  } catch (e) {}
  const newTransactions = []
  let page = 1

  while (1 && !swapFuncParams.useCache) {
    const requestMethod = 'GET'
    const bodyHash = ''
    const contentType = 'application/json'
    const dateString = new Date().toISOString()
    const sigString = `${requestMethod}\n${bodyHash}\n${contentType}\n${dateString}`
    const signature = crypto
      .createHmac('sha256', config.bitaccessBtm.apiSecret)
      .update(sigString, 'utf8')
      .digest('base64')
    try {
      const request = `https://cashapi.bitaccessbtm.com/api/v1/affiliate/${config.bitaccessBtm.affiliateId}/transactions?limit=${PAGE_LIMIT}&page=${page}`
      const options = {
        method: requestMethod,
        headers: {
          Authorization: `HMAC ${config.bitaccessBtm.apiKey}:${signature}`,
          'x-date': dateString,
          'Content-Type': contentType
        }
      }
      const response = await fetch(request, options)
      const result = await response.json()
      const txs = result.result
      for (const tx of txs) {
        if (tx.status === 'complete') {
          const date = new Date(tx.updated_at)
          const timestamp = date.getTime() / 1000

          const ssTx: StandardTx = {
            status: 'complete',
            inputTXID: tx.transaction_id,
            inputAddress: tx.deposit_address,
            inputCurrency: tx.deposit_currency.toUpperCase(),
            inputAmount: tx.deposit_amount,
            outputAddress: tx.withdrawal_address,
            outputCurrency: tx.withdrawal_currency.toUpperCase(),
            outputAmount: tx.withdrawal_amount.toString(),
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

module.exports = { doBitaccessBtm }
