// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fs = require('fs')
const { checkSwapService } = require('./checkSwapService.js')
const csv = require('csvtojson')

const BANXA_CACHE = './cache/banRaw.json'
const BANXA_FOLDER = './cache/banxa'

async function doBanxa (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBanxa,
    BANXA_CACHE,
    'BAN',
    swapFuncParams
  )
}

async function fetchBanxa (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Banxa from CSV...')
  }
  let diskCache = { txs: [] }

  try {
    diskCache = js.readFileSync(BANXA_CACHE)
  } catch (e) {}

  const transactionMap = {}
  const ssFormatTxs: Array<StandardTx> = []

  const files = await fs.readdirSync(BANXA_FOLDER)

  for (const fileName of files) {
    const filePath = `./cache/banxa/${fileName}`
    const csvData = await csv().fromFile(filePath)
    for (const order of csvData) {
      let date
      if (order['UTC Time']) {
        date = new Date(order['UTC Time'])
      } else if (order['Created At (UTC)']) {
        date = new Date(order['Created At (UTC)'])
      } else {
        continue
      }
      const timestamp = date.getTime() / 1000
      const uniqueIdentifier = order['Order Id']
      const ssTx: StandardTx = {
        status: 'complete',
        inputTXID: uniqueIdentifier,
        inputAddress: '',
        inputCurrency: order['Source Currency'],
        inputAmount: parseFloat(order['Source Amount']),
        outputAddress: '',
        outputCurrency: order['Target Currency'],
        outputAmount: order['Target Amount'],
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

  // console.log('ssFormatTxs is: ', ssFormatTxs)

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doBanxa }
