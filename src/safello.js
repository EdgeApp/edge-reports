// @flow
import type { ShapeShiftTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const { checkSwapService } = require('./checkSwapService.js')

const SAFELLO_CACHE = './cache/saRaw.json'

const safelloSecretKey = config.safelloSecretKey

async function doSafello (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchSafello,
    SAFELLO_CACHE,
    'SA',
    swapFuncParams
  )
}

async function fetchSafello (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Safello...')
  }
  let diskCache = { txs: [] }
  try {
    diskCache = js.readFileSync(SAFELLO_CACHE)
  } catch (e) {}

  const ssFormatTxs: Array<ShapeShiftTx> = []

  let offset = 0
  const url = `https://app.safello.com/v1/partner/get-orders?offset=${offset}`

  while (1 && !swapFuncParams.useCache) {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'secret-key': safelloSecretKey
      }
    })

    const json = await response.json()
    const orders = (json && json.orders) ? json.orders : []

    for (const order of orders) {
      console.log(order)

      const ssTx: ShapeShiftTx = {
        status: 'complete',
        inputTXID: order.id,
        inputAddress: '',
        inputCurrency: order.currency,
        inputAmount: order.amount,
        outputAddress: '',
        outputCurrency: order.cryptoCurrency,
        outputAmount: '',
        timestamp: new Date(order.completedDate)
      }
      ssFormatTxs.push(ssTx)
    }
    if (json.size < 100) {
      break
    }

    offset += 100
    if (offset > 500) {
      break
    }
  }

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doSafello }
