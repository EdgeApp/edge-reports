// @flow

import type {StandardTx, SwapFuncParams} from './checkSwapService'

const {checkSwapService} = require('./checkSwapService.js')
const js = require('jsonfile')
const fetch = require('node-fetch')
const crypto = require('crypto')

const confFileName = './config.json'
const config = js.readFileSync(confFileName)

const SIDESHIFT_CACHE = './cache/xaiRaw.json'
const PAGE_LIMIT = 500
const TRANSACTIONS_TO_FETCH = 1500

type SideShiftTransaction = {
  id: string,
  depositAddress: {
    address: string
  },
  depositAsset: string,
  depositMin: number,
  depositMax: number,
  settleAddress: {
    address: string
  },
  settleAsset: string,
  settleAmount: number,
  createdAt: string
}

async function doSideShift (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchSideShift,
    SIDESHIFT_CACHE,
    'XAI',
    swapFuncParams)
}

function affiliateSignature (affiliateId: string, affiliateSecret: string, time: number): string {
  return crypto.createHmac('sha1', affiliateSecret)
    .update(affiliateId + time)
    .digest('hex')
}

async function fetchSideShift (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching SideShift.ai...')
  }
  let diskCache = {txs: []}
  try {
    diskCache = js.readFileSync(SIDESHIFT_CACHE)
  } catch (e) {
    console.log(e)
  }

  const newTransactions: StandardTx[] = []
  let offset = 0

  while (1 && !swapFuncParams.useCache) {
    const time = Date.now()
    const signature = affiliateSignature(config.sideShiftAffiliateId, config.sideShiftAffiliateSecret, time)

    try {
      const url = `https://sideshift.ai/api/affiliate/completedOrders?limit=${PAGE_LIMIT}&offset=${offset}&affiliateId=${config.sideShiftAffiliateId}&time=${time}&signature=${signature}`
      const transactions: SideShiftTransaction[] = await fetch(url)
        .then(response => response.json())

      for (const tx of transactions) {
        const timestamp = new Date(tx.createdAt).getTime() / 1000
        const xaiTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.id,
          inputAddress: tx.depositAddress.address,
          inputCurrency: tx.depositAsset.toUpperCase(),
          inputAmount: tx.depositMin,
          outputAddress: tx.settleAddress.address,
          outputCurrency: tx.settleAsset.toUpperCase(),
          outputAmount: tx.settleAmount.toString(),
          timestamp
        }
        newTransactions.push(xaiTx)
      }

      if (transactions.length < PAGE_LIMIT) {
        break
      }
    } catch (e) {
      console.log(e)
      break
    }
    if (offset > TRANSACTIONS_TO_FETCH) {
      break
    }
    offset += PAGE_LIMIT
  }

  return {
    diskCache,
    newTransactions
  }
}

module.exports = {doSideShift}
