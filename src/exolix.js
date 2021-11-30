// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const EXOLIX_CACHE = './cache/exRaw.json'

const PER_PAGE = 100

async function doExolix (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchExolix,
    EXOLIX_CACHE,
    'EX',
    swapFuncParams
  )
}

async function fetchExolix (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Exolix...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(EXOLIX_CACHE)
  } catch (e) {}
  let page = diskCache.page ? diskCache.page : 1

  const ssFormatTxs: Array<StandardTx> = []

  while (1 && !swapFuncParams.useCache) {
    const response = await fetch(
      `https://exolix.com/api/history?page=${page}&per_page=${PER_PAGE}`,
      {
        Authorization: config.exolixApiKey
      }
    )
    const result = await response.json()

    const txs = result.data

    if (!txs.length) {
      return {}
    }

    for (const tx of txs) {
      if (tx.status === 'success') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.input_hash,
          inputAddress: tx.deposit_address,
          inputCurrency: tx.coin_from.toUpperCase(),
          inputAmount: tx.amount_from,
          outputAddress: tx.destination_address,
          outputCurrency: tx.coin_to.toUpperCase(),
          outputAmount: tx.amount_to,
          timestamp: tx.created_at
        }
        ssFormatTxs.push(ssTx)
      }
    }

    if (result.total < PER_PAGE) {
      break
    }

    page++

    if (result.last_page < page) {
      break
    }
  }

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doExolix }
