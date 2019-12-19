// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const fs = require('fs')
const { checkSwapService } = require('./checkSwapService.js')
const js = require('jsonfile')

const BITY_CACHE = './cache/bityRaw.json'
const BITY_FOLDER = './cache/bity'

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

    for (const order of jsonData.orders) {
      if (!order.input.amount || !order.output.amount || !order.timestamp_executed) {
        continue
      }
      const date = new Date(order.timestamp_executed)
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
      console.log('ssTx: ', ssTx)
      transactionMap[uniqueIdentifier] = ssTx
    }
  }
  for (const id in transactionMap) {
    ssFormatTxs.push(transactionMap[id])
    ssFormatTxs.sort((a, b) => a.timestamp - b.timestamp)
  }

  // console.log('ssFormatTxs is: ', ssFormatTxs)

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doBity }
