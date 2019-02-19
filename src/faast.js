// @flow

import type { ShapeShiftTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const crypto = require('crypto')
const fetch = require('node-fetch')
const SS_QUERY_PAGES = 3
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const FILE_CACHE = './cache/faastRaw.json'
const PAGE_LIMIT = 50

async function doFaast (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchFaast, FILE_CACHE, 'FA', swapFuncParams)
}

async function fetchFaast (swapFuncParams: SwapFuncParams) {
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(FILE_CACHE)
  } catch (e) {}
  const cachedTransactions = diskCache.txs
  console.log(`Read txs from cache: ${cachedTransactions.length}`)
  const newTransactions = []
  let page = 1

  while (1 && !swapFuncParams.useCache) {
    console.log(`Querying faast...`)
    const nonce = String(Date.now())
    const signature = crypto
      .createHmac('sha256', config.faastSecret)
      .update(nonce)
      .digest('hex')
    try {
      const request = `https://api.faa.st/api/v2/public/affiliate/swaps?limit=${PAGE_LIMIT}&page=${page}`
      const options = {
        method: 'GET',
        headers: {
          'affiliate-id': `${config.faastAffiliateId}`,
          nonce,
          signature
        }
      }
      const response = await fetch(request, options)
      const result = await response.json()
      const txs = result.orders
      for (const tx of txs) {
        if (tx.status === 'complete') {
          const date = new Date(tx.updated_at)
          const timestamp = date.getTime() / 1000

          const ssTx: ShapeShiftTx = {
            status: 'complete',
            inputTXID: tx.transaction_id,
            inputAddress: tx.deposit_address,
            inputCurrency: tx.deposit_currency.toUpperCase(),
            inputAmount: tx.amount_deposited,
            outputAddress: tx.withdrawal_address,
            outputCurrency: tx.withdrawal_currency.toUpperCase(),
            outputAmount: tx.amount_withdrawn.toString(),
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

module.exports = { doFaast }
