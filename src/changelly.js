// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const Changelly = require('api-changelly/lib.js')
const js = require('jsonfile')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const CHANGELLY_CACHE = './cache/chRaw.json'

const isConfigValid = (typeof config.changellyApiKey !== 'undefined') && (typeof config.changellyApiSecret !== 'undefined')

const changelly = isConfigValid ? new Changelly(
  config.changellyApiKey,
  config.changellyApiSecret
) : {}

async function doChangelly (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchChangelly,
    CHANGELLY_CACHE,
    'CH',
    swapFuncParams
  )
}

const getTransactionsPromised = (
  limit,
  offset,
  currencyFrom,
  address,
  extraId
) => {
  return new Promise((resolve, reject) => {
    changelly.getTransactions(
      limit,
      offset,
      currencyFrom,
      address,
      extraId,
      (err, data) => {
        if (err) {
          reject(err)
        } else {
          resolve(data)
        }
      }
    )
  })
}

async function fetchChangelly (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Changelly...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(CHANGELLY_CACHE)
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
      offset,
      undefined,
      undefined,
      undefined
    )
    console.log(`Changelly: offset:${offset} count:${result.result.length}`)

    for (const tx of result.result) {
      if (tx.status === 'finished') {
        const ssTx: StandardTx = {
          status: 'complete',
          inputTXID: tx.payinHash,
          inputAddress: tx.payinAddress,
          inputCurrency: tx.currencyFrom.toUpperCase(),
          inputAmount: tx.amountExpectedFrom,
          outputAddress: tx.payoutAddress,
          outputCurrency: tx.currencyTo.toUpperCase(),
          outputAmount: tx.amountExpectedTo,
          timestamp: tx.createdAt
        }
        ssFormatTxs.push(ssTx)
      }
    }
    if (result.result.length < 100) {
      // console.log('length < 100, stopping query')
      break
    }

    // console.log(`Changelly completed: ${ssFormatTxs.length}`)
    if (offset > 1000) {
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

module.exports = { doChangelly, isConfigValid }
