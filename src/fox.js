// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const fetch = require('node-fetch')
const js = require('jsonfile')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const FOX_CACHE = './cache/foxRaw.json'

const isConfigValid = (typeof config.foxCredentials !== 'undefined') &&
                      (typeof config.foxCredentials.apiKey !== 'undefined') &&
                      (typeof config.foxCredentials !== 'undefined') &&
                      (typeof config.foxCredentials.secretToken !== 'undefined')

async function doFox (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchFox,
    FOX_CACHE,
    'FOX',
    swapFuncParams
  )
}

const getTransactionsPromised = async (
  limit,
  offset
) => {
  const res = await fetch(`https://fox.exchange/api/cs/orders?count=${limit}&start=${offset}`, {
    headers: {
      'x-api-key': config.foxCredentials.apiKey,
      'x-secret-token': config.foxCredentials.secretToken
    }
  })
  return res.json() // async
}

async function fetchFox (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching fox.exchange...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(FOX_CACHE)
  } catch (e) {}
  // const cachedTransactions = diskCache.txs
  // console.log(`Read txs from cache: ${cachedTransactions.length}`)
  // let offset = diskCache.offset ? diskCache.offset : 0
  let offset = 0
  const ssFormatTxs: Array<StandardTx> = []

  while (1 && !swapFuncParams.useCache) {
    // console.log(`Querying offset ${offset}`)
    const result = await getTransactionsPromised(
      100,
      offset
    )

    if (result.error) throw new Error(`fox error ${result.error}`)
    // console.log(`fox.exchange: offset:${offset} count:${result.data.items.length}`)

    for (const tx of result.data.items) {
      if (tx.status === 'complete') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.orderId,
          inputAddress: tx.exchangeAddress.address,
          inputCurrency: tx.depositCoin.toUpperCase(),
          inputAmount: tx.depositCoinAmount,
          outputAddress: tx.destinationAddress.address,
          outputCurrency: tx.destinationCoin.toUpperCase(),
          outputAmount: tx.destinationCoinAmount.toString(),
          timestamp: tx.createdAt / 1000
        }
        ssFormatTxs.push(ssTx)
      }
    }
    if (result.data.items.length < 100) {
      // console.log('length < 100, stopping query')
      break
    }

    // console.log(`fox.exchange completed: ${ssFormatTxs.length}`)
    if (offset > 300) { // NOT SURE THIS IS RIGHT?!
      // console.log('length < 100, stopping query')
      break
    }
    offset += 100
    // break
  }
  // diskCache.offset = offset > 600 ? offset - 600 : offset
  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doFox, isConfigValid }
