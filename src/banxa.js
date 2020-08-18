// @flow
import type { StandardTx, SwapFuncParams } from './checkSwapService.js'
const js = require('jsonfile')
const fetch = require('node-fetch')
const { checkSwapService } = require('./checkSwapService.js')
const crypto = require('crypto')
const sleep = require('sleep')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)

const BANXA_CACHE = './cache/banRaw.json'

const MONTH_MAP = {
  'Jan': '01',
  'Feb': '02',
  'Mar': '03',
  'Apr': '04',
  'May': '05',
  'Jun': '06',
  'Jul': '07',
  'Aug': '08',
  'Sep': '09',
  'Oct': '10',
  'Nov': '11',
  'Dec': '12'
}

async function doBanxa (swapFuncParams: SwapFuncParams) {
  return checkSwapService(fetchBanxa,
    BANXA_CACHE,
    'BAN',
    swapFuncParams
  )
}

async function callBanxaAPI (queryDate, pageLimit, page) {
  const nonce = Math.floor(new Date() / 1000)

  const apiQuery = `/api/orders?start_date=${queryDate}&end_date=${queryDate}&per_page=${pageLimit}&page=${page}`

  const text = `GET\n${apiQuery}\n${nonce}`
  const secret = config.banxaToken
  const key = 'EDGE'
  const hmac = crypto.createHmac('sha256', secret)
    .update(text)
    .digest('hex')
  const authHeader = key + ':' + hmac + ':' + nonce

  const headers = {
    'Authorization': 'Bearer ' + authHeader,
    'Content-Type': 'application/json'
  }

  return fetch(`https://edge.banxa.com${apiQuery}`, {headers: headers})
}

function processOrders (orders, ssFormatTxs) {
  for (const order of orders) {
    if (order.status === 'complete') {
      // Reformat the date from DD-MMM-YYYY HH:MM:SS to YYYY-MM-DDTHH:MM:SS
      const origDateTime = order.created_at
      const dateTimeParts = origDateTime.split(' ')
      const dateParts = dateTimeParts[0].split('-')
      const month = MONTH_MAP[dateParts[1]]
      const reformattedDate = `${dateParts[2]}-${month}-${dateParts[0]}T${dateTimeParts[1]}`

      // Flip the amounts if the order is a SELL
      let inputAmount = order.fiat_amount
      let inputCurrency = order.fiat_code
      let outputAmount = order.coin_amount
      let outputCurrency = order.coin_code
      if (order.order_type === 'CRYPTO-SELL') {
        inputAmount = order.coin_amount
        inputCurrency = order.coin_code
        outputAmount = order.fiat_amount
        outputCurrency = order.fiat_code
      }

      const ssTx: StandardTx = {
        status: 'complete',
        inputTXID: order.ref.toString(),
        inputAddress: '',
        inputCurrency: inputCurrency,
        inputAmount: inputAmount,
        outputAddress: order.wallet_address,
        outputCurrency: outputCurrency,
        outputAmount: outputAmount,
        timestamp: new Date(reformattedDate).getTime() / 1000
      }
      ssFormatTxs.push(ssTx)
    }
  }
}

async function fetchBanxa (swapFuncParams: SwapFuncParams) {
  if (!swapFuncParams.useCache) {
    console.log('Fetching Banxa from API...')
  }
  let diskCache = { last_date: '2019-08-26', txs: [] }

  try {
    diskCache = js.readFileSync(BANXA_CACHE)
  } catch (e) {}
  const ssFormatTxs: Array<StandardTx> = []

  const lastDate = new Date(diskCache.last_date)

  // Go back a week just to make sure you capture any late completing orders
  lastDate.setTime(lastDate.getTime() - (7 * 86400000))

  const now = new Date()
  const today = new Date(now.toISOString().split('T')[0]).getTime()

  let queryDate = lastDate.toISOString().split('T')[0]

  if (!swapFuncParams.useCache) {
    console.log(`BANXA: Loading orders starting from ${queryDate}`)
    // Loop through the days
    while (lastDate.getTime() !== today) {
      let page = 1
      const pageLimit = 100
      queryDate = lastDate.toISOString().split('T')[0]
      // Move last date on 1 day
      lastDate.setTime(lastDate.getTime() + 86400000)
      let attempt = 0

      // Loop through the pages for this day
      while (1) {
        let orders = []

        let apiResponse
        while (attempt < 3) {
          console.log(`BANXA: Calling API with date ${queryDate}, result size ${pageLimit} and offset ${page} for attempt ${attempt}`)
          apiResponse = await callBanxaAPI(queryDate, pageLimit, page)
          const status = await apiResponse.status
          // Handle the situation where the API is rate limiting the requests
          if (status !== 200) {
            console.log(`BANXA: Response code ${status}. Retrying after 2 second sleep...`)
            sleep.sleep(2)
            attempt++
          } else {
            break
          }
        }
        if (attempt === 3) break

        if (apiResponse) {
          const ordersData = await apiResponse.json()

          if (ordersData && ordersData.data && ordersData.data.orders.length) orders = ordersData.data.orders
          else break

          processOrders(orders, ssFormatTxs)

          if (orders.length < pageLimit) break
          page++
        }
      }
      if (attempt === 3) {
        console.log(`BANXA: Unable to process date ${queryDate}`)
        break
      }
    }
  }

  diskCache.last_date = queryDate

  const out = {
    diskCache,
    newTransactions: ssFormatTxs
  }
  return out
}

module.exports = { doBanxa }
