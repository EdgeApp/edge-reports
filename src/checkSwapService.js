// @flow
const fs = require('fs')
const js = require('jsonfile')
const fetch = require('node-fetch')
const { bns } = require('biggystring')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const jsonFormat = require('json-format')

const coinMarketCapExcludeLookup = config.coinMarketCapExcludeLookup || []
const coinApiRateLookupError = 'COINAPI_RATE_PAIR_ERROR'

export type TxData = {
  txCount: number,
  // avgBtc: string,
  // avgUsd: string,
  currencyAmount: { [currencyCode: string]: string },
  amountBtc: string,
  amountUsd: string,
}

export type TxDataMap = { [currencyCode: string]: TxData }

export type StandardTx = {
  inputTXID: string,
  inputAddress: string,
  inputCurrency: string,
  inputAmount: number,
  outputAddress: string,
  outputCurrency: string,
  status: string, // complete,
  timestamp: number,
  outputAmount: string
}

export type SwapFuncParams = {
  useCache: boolean,
  interval: string, // ie 'month', 'day', 'hour', 'mins'
  endDate: string // ie '2018-01'
}

let _coincapResults
let _exchangeratesapiResults
let haveAttemptedExchangeRates = false

const jsonConfig = {
  type: 'space',
  size: 2
}

let ratePairs: { [date: string]: { [code: string]: string } } = {}
let ratesLoaded = false
let btcRates = {}
let btcRatesLoaded = false

// type getBtcRateOptions = {
//   from: string,
//   to: string,
//   year: string,
//   month: string,
//   day: string
// }

function clearCache () {
  ratePairs = {}
  ratesLoaded = false
  btcRates = {}
  btcRatesLoaded = false
}

async function queryCoinApiForUsdRate (currencyCode: string, date: string) {
  const currentTimestamp = Date.now()
  const targetDate = new Date(date)
  const targetTimestamp = targetDate.getTime()
  // if less than 90 days old (cmc API restriction) <<== Is this true for CoinApi?
  const soonerThan90Days = currentTimestamp - targetTimestamp < 89 * 86400 * 1000
  const isApiKeyConfigured = config.coinApiKey
  const isCurrencyExcluded = coinMarketCapExcludeLookup.find(c => c === currencyCode.toUpperCase())
  if (
    soonerThan90Days &&
    isApiKeyConfigured &&
    !isCurrencyExcluded
  ) {
    const url = `https://rest.coinapi.io/v1/exchangerate/${currencyCode}/USD?time=${date}T00:00:00.0000000Z&apiKey=${config.coinApiKey}`
    try {
      const response = await fetch(url, {
        method: 'GET'
      })
      if (response.status === 200) {
        const jsonObj = await response.json()
        if (!jsonObj.rate) {
          return coinApiRateLookupError
        }
        return jsonObj.rate.toString()
      } else {
        return ''
      }
    } catch (e) {
      console.log(e)
      console.log(`${date} ${currencyCode}`)
      return ''
    }
  } else {
    return ''
  }
}

async function queryCoinMarketCapForUsdRate (currencyCode: string, date: string) {
  const currentTimestamp = Date.now()
  const targetDate = new Date(date)
  const targetTimestamp = targetDate.getTime()
  // if less than 90 days old (cmc API restriction)
  const soonerThan90Days = currentTimestamp - targetTimestamp < 89 * 86400 * 1000
  const isApiKeyConfigured = config.coinMarketCapAPiKey
  const isCurrencyExcluded = coinMarketCapExcludeLookup.find(c => c === currencyCode.toUpperCase())

  if (
    soonerThan90Days &&
    isApiKeyConfigured &&
    !isCurrencyExcluded
  ) {
    const url = `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/historical?symbol=${currencyCode}&time_end=${date}&count=1`

    let response
    const fetchOptions = {
      method: 'GET',
      headers: {
        'X-CMC_PRO_API_KEY': config.coinMarketCapAPiKey
      },
      json: true
    }

    try {
      response = await fetch(url, fetchOptions)
      const jsonObj = await response.json()
      if (!jsonObj || !jsonObj.data || !jsonObj.data.quotes || !jsonObj.data.quotes[0] || !jsonObj.data.quotes[0].quote || !jsonObj.data.quotes[0].quote.USD) {
        throw new Error(`No rate from CMC: ${currencyCode}`)
      }
      return jsonObj.data.quotes[0].quote.USD.price.toString()
    } catch (e) {
      console.log(`No CoinMarketCap ${currencyCode} quote: `, e)
      throw e
    }
  } else {
    return ''
  }
}

async function checkSwapService (
  theFetch: Function,
  cacheFile: string,
  prefix: string,
  swapFuncParams: SwapFuncParams
) {
  clearCache()

  const { endDate } = swapFuncParams
  // diskCache is the [prefix]Raw.json file's transactions and an 'offset' property (that is persistent)
  const { diskCache, newTransactions } = await theFetch(swapFuncParams)
  let cachedTransactions = diskCache.txs

  // Find duplicates
  let numAdded = 0
  const newTxsNoDupes = []
  for (const newTx of newTransactions) {
    let match = false
    // omit transactions that exist in the older pre-existing cache
    for (const oldTx of cachedTransactions) {
      if (
        oldTx.inputTXID === newTx.inputTXID &&
        oldTx.status === newTx.status
      ) {
        match = true
        break
      }
    }
    if (!match) {
      newTxsNoDupes.push(newTx)
      numAdded++
    }
  }
  // add new tx to cached tx to get new list of total tx
  cachedTransactions = cachedTransactions.concat(newTxsNoDupes)
  cachedTransactions.sort((a, b) => {
    return b.timestamp - a.timestamp
  })

  if (!swapFuncParams.useCache) {
    console.log(
      `*** NEW TXS: ${numAdded.toString()} of downloaded: ${newTransactions.length.toString()}\n`
    )
  }

  diskCache.txs = cachedTransactions
  // write new list of tx to cache / disk
  const out = jsonFormat(diskCache, jsonConfig)
  fs.writeFileSync(cacheFile, out)

  const txDataMap: { [date: string]: TxData } = {}
  let amountTotal = '0'
  let revTotal = '0'
  let grandTotalAmount = '0'
  // run routine to s
  for (const tx: StandardTx of cachedTransactions) {
    if (tx.status !== 'complete') {
      continue
    }
    const date: Date = new Date(tx.timestamp * 1000)
    const year = date.getUTCFullYear()
    const month = pad(date.getUTCMonth() + 1, 2)
    const day = pad(date.getUTCDate(), 2)
    const hour = pad(date.getUTCHours(), 2)
    const mins = pad(date.getUTCMinutes(), 2)
    const dateStr = `${year.toString()}-${month}-${day}`

    let idx
    const { interval } = swapFuncParams
    if (interval === 'day') {
      idx = `${year}-${month}-${day}` // eg 2019-01-01
    } else if (interval === 'month') {
      idx = `${year}-${month}` // eg 2019-01
    } else if (interval === 'hour') {
      idx = `${year}-${month}-${day}-${hour}` // eg 2919-01-01-12
    } else if (interval === 'mins') {
      idx = `${year}-${month}-${day}-${hour}-${mins}` // eg 2019-01-01-12-30
    } else {
      idx = `${year}-${month}` // default to year-month
    }

    // change date format to number (eg 201901010000)
    let idxCompare = idx.replace(/-/g, '')
    idxCompare = padRight(idxCompare, 12)
    let dateCompare = endDate.replace(/-/g, '')
    dateCompare = padRight(dateCompare, 12)

    // if the date of the transaction is greater than the index
    if (bns.gt(dateCompare, idxCompare)) {
      break
    }

    // if the calculated data for the index date doesn't exist, then create it
    if (txDataMap[idx] === undefined) {
      txDataMap[idx] = {
        txCount: 0,
        amountBtc: '0',
        amountUsd: '0',
        // avgBtc: '0',
        // avgUsd: '0',
        currencyAmount: {}
      }
    }
    //
    txDataMap[idx].txCount++

    let amountBtc: string = '0'
    let amountUsd: string = '0'
    // libertyX gives USD amounts
    if (
      tx.inputCurrency === 'USD' &&
      tx.outputCurrency === 'USD'
    ) { // we will not calculate the BTC equivalent (because no BTC was involved?)
      amountBtc = '0'
      amountUsd = tx.outputAmount
    } else {
      const btcToUsdRate = await getUsdRate('BTC', dateStr)
      const txInputToUsdRate = await getUsdRate(tx.inputCurrency, dateStr)
      if (txInputToUsdRate !== '0') {
        amountUsd = bns.div(tx.inputAmount.toString(), txInputToUsdRate, 8)
      }

      // most partners
      if (tx.inputCurrency === 'BTC') {
        amountBtc = tx.inputAmount.toString()
      } else {
        // get exchange currency and convert to BTC equivalent for that date and time
        // then find out equivalent amount of BTC
        // First, check the btcRates cache file...
        let btcToTxInputCurRate = queryBtcRates(tx.inputCurrency)
        if (!btcToTxInputCurRate) {
          // If it's not cached yet then we'll have to generate it the long way...
          if (txInputToUsdRate !== coinApiRateLookupError && txInputToUsdRate !== '0') {
            btcToTxInputCurRate = bns.div(btcToUsdRate, txInputToUsdRate, 8)
          }
          // And update the cache...
          if (btcToTxInputCurRate && btcToTxInputCurRate !== '') {
            updateBtcRate(tx.inputCurrency, btcToTxInputCurRate)
          }
        }
        amountBtc = bns.mul(btcToTxInputCurRate, tx.inputAmount.toString())
      }
    }
    // now stick it into the txDataMap
    txDataMap[idx].amountBtc = bns.add(txDataMap[idx].amountBtc, amountBtc)
    txDataMap[idx].amountUsd = bns.add(txDataMap[idx].amountUsd, amountUsd)
    const rev = bns.mul(amountBtc, '0.0025')

    amountTotal = bns.add(amountTotal, amountBtc)
    grandTotalAmount = bns.add(grandTotalAmount, amountBtc)
    revTotal = bns.add(revTotal, rev)
    // and also credit to altcoin numbers
    if (txDataMap[idx].currencyAmount[tx.inputCurrency] === undefined) {
      txDataMap[idx].currencyAmount[tx.inputCurrency] = '0'
    }

    if (txDataMap[idx].currencyAmount[tx.outputCurrency] === undefined) {
      txDataMap[idx].currencyAmount[tx.outputCurrency] = '0'
    }

    const halfAmount = bns.div(amountUsd, '2', 2)

    txDataMap[idx].currencyAmount[tx.inputCurrency] = bns.add(
      txDataMap[idx].currencyAmount[tx.inputCurrency],
      halfAmount
    )
    txDataMap[idx].currencyAmount[tx.outputCurrency] = bns.add(
      txDataMap[idx].currencyAmount[tx.outputCurrency],
      halfAmount
    )
  }

  return txDataMap
}

function queryRatePairs (currencyCode: string, date: string) {
  if (!ratesLoaded) {
    try {
      ratePairs = js.readFileSync('./cache/ratePairs.json')
    } catch (e) {
      console.log(e)
      return ''
    }
  }
  ratesLoaded = true
  if (ratePairs[date]) {
    return ratePairs[date][currencyCode]
  } else {
    return ''
  }
}

function updateRatePairs (currencyCode: string, date: string, usdRate: string) {
  if (!ratePairs[date]) {
    ratePairs[date] = {}
  }

  if (!ratePairs[date][currencyCode]) {
    ratePairs[date][currencyCode] = usdRate
    js.writeFileSync('./cache/ratePairs.json', ratePairs)
  }
}

async function getUsdRate (currencyCode: string, date: string) {
  if (currencyCode === 'USD') {
    return '1'
  }
  let usdRate = await getHistoricalUsdRate(currencyCode, date)
  if (!usdRate || usdRate === '') {
    usdRate = await getCurrentUsdRate(currencyCode)
  }
  return usdRate
}

async function getHistoricalUsdRate (currencyCode: string, date: string) {
  let usdRate = queryRatePairs(currencyCode, date)
  if (usdRate !== coinApiRateLookupError) {
    if (!usdRate || usdRate === '') {
      usdRate = await queryCoinMarketCapForUsdRate(currencyCode, date)
      if (!usdRate || usdRate === '') {
        usdRate = await queryCoinApiForUsdRate(currencyCode, date)
      }
    }

    if (usdRate && usdRate !== '') {
      updateRatePairs(currencyCode, date, usdRate)
    } else {
      // If currencyCode & date pair are NOT found in either CoinMarketCap nor CoinApi then
      //  mark it as being in 'error' in the ratePairs cache structure
      updateRatePairs(currencyCode, date, coinApiRateLookupError)
    }

    return usdRate
  } else {
    return ''
  }
}

function queryBtcRates (currencyCode: string) {
  if (!btcRatesLoaded) {
    // check btcRates
    try {
      btcRates = js.readFileSync('./cache/btcRates.json')
    } catch (e) {
      console.log(e)
    }
    btcRatesLoaded = true
  }

  const pair = `${currencyCode}_BTC`
  if (btcRates[pair]) {
    return btcRates[pair]
  } else {
    return ''
  }
}

function updateBtcRate (currencyCode: string, rate: string) {
  const pair = `${currencyCode}_BTC`
  if (!btcRates[pair]) {
    btcRates[pair] = rate
    js.writeFileSync('./cache/btcRates.json', btcRates)
  }
}

async function queryCoinCap (currencyCode: string) {
  if (!_coincapResults) {
    const request = `https://api.coincap.io/v2/assets`
    const response = await fetch(request)
    _coincapResults = await response.json()
  }

  if (_coincapResults.data) {
    return (_coincapResults.data.find(datum => datum.symbol.toUpperCase() === currencyCode) || {}).priceUsd
  } else {
    return ''
  }
}

async function getCurrentUsdRate (currencyCode: string) {
  let usdRate = await queryCoinCap(currencyCode)
  if (!usdRate || usdRate === '') {
    usdRate = await getFiatRate(currencyCode, 'USD')
  }

  if (!usdRate || usdRate === '') {
    return '0'
  } else {
    return usdRate
  }
}

// problematic routine, should be called "getHistoricalRate"?
// async function getBtcRate (opts: getBtcRateOptions): Promise<string> {
//   const { from, to, year, month, day } = opts
//   const date = `${year}-${month}-${day}`
//   const pair = `${from}_${to}`
//
//   let fromToUsd
//   let toToUsd
//   try {
//     // if the pair data already exists in memory (no date, though)...
//     if (btcRates[pair]) {
//       // these rates are not historical, only ad-hoc
//       // console.log('ad-hoc crypto-to-BTC rates are available in memory')
//     }
//     fromToUsd = await getHistoricalUsdRate(from.toUpperCase(), date)
//     toToUsd = await getHistoricalUsdRate(to.toUpperCase(), date)
//     // const finalRate = bns.div(fromToUsd, toToUsd, 8)
//     const finalRate = bns.div('1', '1', 8)
//     return finalRate
//   } catch (e) {
//     try {
//       // if the ad-hoc rates have not been loaded, then load them
//       if (!btcRatesLoaded) {
//         // check btcRates
//         try {
//           btcRates = js.readFileSync('./cache/btcRates.json')
//         } catch (e) {
//           console.log(e)
//         }
//         btcRatesLoaded = true
//       }
//       // and try to return the rate
//       if (btcRates[pair]) {
//         return btcRates[pair]
//       }
//       // if coincap.io has not been queried yet, query and store results
//       if (!_coincapResults) {
//         const request = `https://api.coincap.io/v2/assets`
//         const response = await fetch(request)
//         _coincapResults = await response.json()
//       }
//       for (const c of _coincapResults.data) {
//         if (c.symbol.toUpperCase() === from.toUpperCase()) {
//           fromToUsd = c.priceUsd
//         }
//         if (c.symbol.toUpperCase() === to.toUpperCase()) {
//           toToUsd = c.priceUsd
//         }
//         if (fromToUsd && toToUsd) {
//           break
//         }
//       }
//
//       // Try to get fiat rates
//       if (!fromToUsd) {
//         fromToUsd = await getFiatRate(from, 'USD')
//       }
//       if (!toToUsd) {
//         toToUsd = await getFiatRate(to, 'USD')
//       }
//
//       // write ad-hoc rates to btcRates.json and return rates
//       if (fromToUsd && toToUsd) {
//         const rate = bns.div(fromToUsd, toToUsd, 8)
//         btcRates[pair] = rate
//         js.writeFileSync('./cache/btcRates.json', btcRates)
//         return rate
//       }
//       return '0'
//     } catch (e) {
//       throw e
//     }
//   }
// }

/*
 * Finds the exchange rate from one fiat currency to another.
 * Returns: String w/ float-value or undefined if either currency is not found
 */
async function getFiatRate (fromFiatCurrency: string, toFiatCurrency: string) {
  await initExchangeRates()

  const fromToBaseRate = findInExchangeRate(fromFiatCurrency)
  const toToBaseRate = findInExchangeRate(toFiatCurrency)
  if (fromToBaseRate && toToBaseRate) {
    const rate = fromToBaseRate / toToBaseRate
    return `${rate}` // cast float-->string
  }

  return ''
}

async function initExchangeRates () {
  if (!haveAttemptedExchangeRates) {
    haveAttemptedExchangeRates = true
    if (!_exchangeratesapiResults) {
      const request = 'https://api.exchangeratesapi.io/latest'
      const response = await fetch(request)
      _exchangeratesapiResults = await response.json()
    }
  }
}

function findInExchangeRate (fiatCurrency: string) {
  if (_exchangeratesapiResults && _exchangeratesapiResults.rates && _exchangeratesapiResults.base) {
    if (fiatCurrency === _exchangeratesapiResults.base) {
      return 1
    }
    for (const c of Object.keys(_exchangeratesapiResults.rates)) {
      if (c.toUpperCase() === fiatCurrency.toUpperCase()) {
        return _exchangeratesapiResults.rates[c]
      }
    }
  } else {
    console.warn('Missing or malformed _exchangeratesapiResults')
  }
  return undefined
}

// {
//   "time": "2019-04-26T23:59:59.6886775Z",
//   "asset_id_base": "BTC",
//   "asset_id_quote": "USD",
//   "rate": 5242.7856103737234839148323278
// }

function pad (num, size) {
  let s = num + ''
  while (s.length < size) {
    s = '0' + s
  }
  return s
}

function padRight (num, size) {
  let s = num + ''
  while (s.length < size) {
    s = s + '0'
  }
  return s
}

module.exports = { checkSwapService }
