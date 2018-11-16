// @flow
const fs = require('fs')
const js = require('jsonfile')
const fetch = require('node-fetch')
const { sprintf } = require('sprintf-js')
const { bns } = require('biggystring')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const jsonFormat = require('json-format')

export type ShapeShiftTx = {
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
  interval: string,
  endDate: string
}

let _coincapQuery

const jsonConfig = {
  type: 'space',
  size: 2
}

function pad (num, size) {
  let s = num + ''
  while (s.length < size) {
    s = '0' + s
  }
  return s
}

let ratePairs: { [date: string]: { [code: string]: string } } = {}
let ratesLoaded = false
let btcRates = {}
let btcRatesLoaded = false

type GetRateOptions = {
  from: string,
  to: string,
  year: string,
  month: string,
  day: string
}

function clearCache () {
  ratePairs = {}
  ratesLoaded = false
  btcRates = {}
  btcRatesLoaded = false
}

async function queryCoinApi (currencyCode: string, date: string) {
  // const url = `https://rest.coinapi.io/v1/exchangerate/${currencyCode}/USD?time=2017-08-09T12:00:00.0000000Z`
  const url = `https://rest.coinapi.io/v1/exchangerate/${currencyCode}/USD?time=${date}T00:00:00.0000000Z`
  // const url = `https://rest.coinapi.io/v1/exchangerate/${currencyCode}/USD`
  //   if (!doSummary) {
  //     console.log(url)
  //   }
  let response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        'X-CoinAPI-Key': config.coinApiKey
      }
    })
    const jsonObj = await response.json()
    if (!jsonObj.rate) {
      throw new Error('No rate from CoinAPI')
    }
    return jsonObj.rate.toString()
  } catch (e) {
    // if (!doSummary) {
    //   console.log(e)
    // }
    throw e
  }
}

async function getPairCached (currencyCode: string, date: string) {
  if (!ratesLoaded) {
    try {
      ratePairs = js.readFileSync('./ratePairs.json')
    } catch (e) {
      console.log(e)
    }
  }
  ratesLoaded = true

  let rate
  if (ratePairs[date] && ratePairs[date][currencyCode]) {
    rate = ratePairs[date][currencyCode]
  } else {
    if (!ratePairs[date]) {
      ratePairs[date] = {}
    }
    rate = await queryCoinApi(currencyCode, date)
    ratePairs[date][currencyCode] = rate
    js.writeFileSync('./ratePairs.json', ratePairs)
  }
  return rate
}

async function getRate (opts: GetRateOptions): Promise<string> {
  const { from, to, year, month, day } = opts
  const date = `${year}-${month}-${day}`
  const pair = `${from}_${to}`

  let fromToUsd
  let toToUsd
  try {
    if (btcRates[pair]) {
      throw new Error('blah')
    }
    fromToUsd = await getPairCached(from.toUpperCase(), date)
    toToUsd = await getPairCached(to.toUpperCase(), date)
    const finalRate = bns.div(fromToUsd, toToUsd, 8)
    return finalRate
  } catch (e) {
    try {
      if (!btcRatesLoaded) {
        try {
          btcRates = js.readFileSync('./btcRates.json')
        } catch (e) {
          console.log(e)
        }
        btcRatesLoaded = true
      }
      if (btcRates[pair]) {
        return btcRates[pair]
      }

      if (!_coincapQuery) {
        const request = `https://coincap.io/front`
        const response = await fetch(request)
        _coincapQuery = await response.json()
      }
      for (const c of _coincapQuery) {
        if (c.short.toUpperCase() === from.toUpperCase()) {
          fromToUsd = c.price.toString()
        }
        if (c.short.toUpperCase() === to.toUpperCase()) {
          toToUsd = c.price.toString()
        }
        if (fromToUsd && toToUsd) {
          break
        }
      }
      if (fromToUsd && toToUsd) {
        const rate = bns.div(fromToUsd, toToUsd, 8)
        btcRates[pair] = rate
        js.writeFileSync('./btcRates.json', btcRates)
        return rate
      }
      return '0'
    } catch (e) {
      throw e
    }
  }
}

async function checkSwapService (
  theFetch: Function,
  cacheFile: string,
  prefix: string,
  swapFuncParams: SwapFuncParams
) {
  clearCache()
  // const diskCache = js.readFileSync(cacheFile)
  // const cachedTransactions = diskCache.txs
  // console.log(`Read txs from cache: ${cachedTransactions.length}`)
  // let newTransactions = []
  // if (!useCache) {
  //   while (newTransactions.length === 0) {
  //     try {
  //       const newQuery = await theFetch()
  //       newTransactions = newQuery.txs
  //       console.log(`Got new transactions... ${newTransactions.length}`)
  //     } catch (e) {
  //       console.log(e)
  //       return
  //     }
  //   }
  // }

  const { diskCache, newTransactions } = await theFetch(swapFuncParams)
  let cachedTransactions = diskCache.txs

  // Find duplicates
  let numAdded = 0
  const newTxsNoDupes = []
  for (const newTx of newTransactions) {
    let match = false
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
  cachedTransactions = cachedTransactions.concat(newTxsNoDupes)
  cachedTransactions.sort((a, b) => {
    return b.timestamp - a.timestamp
  })

  if (!swapFuncParams.useCache) {
    console.log(
      'Number of downloaded transactions: ' + newTransactions.length.toString()
    )
    console.log('Number of new transactions: ' + numAdded.toString())
  }

  diskCache.txs = cachedTransactions
  const out = jsonFormat(diskCache, jsonConfig)
  fs.writeFileSync(cacheFile, out)

  const txCountMap: { [date: string]: number } = {}
  const avgBtcMap: { [date: string]: string } = {}
  const avgUsdMap: { [date: string]: string } = {}
  const currencyAmountMap: {
    [date: string]: { [currencyCode: string]: string }
  } = {}
  const amountBtcMap: { [date: string]: string } = {}
  const amountUsdMap: { [date: string]: string } = {}
  const revMap: { [date: string]: string } = {}
  let amountTotal = '0'
  let revTotal = '0'
  let grandTotalAmount = '0'
  for (const tx: ShapeShiftTx of cachedTransactions) {
    if (tx.status !== 'complete') {
      continue
    }
    const date: Date = new Date(tx.timestamp * 1000)
    const year = date.getUTCFullYear()
    const month = pad(date.getUTCMonth() + 1, 2)
    const day = pad(date.getUTCDate(), 2)
    const hour = pad(date.getUTCHours(), 2)
    const mins = pad(date.getUTCMinutes(), 2)

    let idx
    const { interval } = swapFuncParams
    if (interval === 'day') {
      idx = `${year}-${month}-${day}`
    } else if (interval === 'month') {
      idx = `${year}-${month}`
    } else if (interval === 'hour') {
      idx = `${year}-${month}-${day}-${hour}`
    } else if (interval === 'mins') {
      idx = `${year}-${month}-${day}-${hour}-${mins}`
    } else {
      idx = `${year}-${month}`
    }

    if (idx.startsWith(config.endDate)) {
      break
    }

    if (txCountMap[idx] === undefined) {
      txCountMap[idx] = 0
      amountBtcMap[idx] = '0'
      amountUsdMap[idx] = '0'
      revMap[idx] = '0'
      avgBtcMap[idx] = '0'
      avgUsdMap[idx] = '0'
      currencyAmountMap[idx] = {}
    }
    txCountMap[idx]++

    let amountBtc: string = '0'
    if (tx.inputCurrency === 'BTC') {
      amountBtc = tx.inputAmount.toString()
    } else {
      const rate = await getRate({
        from: tx.inputCurrency,
        to: 'BTC',
        year: year.toString(),
        month,
        day
      })
      amountBtc = bns.mul(rate, tx.inputAmount.toString())
    }
    const btcRate = await getPairCached(
      'BTC',
      `${year.toString()}-${month}-${day}`
    )
    const amountUsd = bns.mul(amountBtc, btcRate)
    amountBtcMap[idx] = bns.add(amountBtcMap[idx], amountBtc)
    amountUsdMap[idx] = bns.add(amountUsdMap[idx], amountUsd)
    const rev = bns.mul(amountBtc, '0.0025')
    revMap[idx] = bns.add(revMap[idx], rev)
    avgBtcMap[idx] = bns.div(amountBtcMap[idx], txCountMap[idx].toString(), 4)
    avgUsdMap[idx] = bns.div(amountUsdMap[idx], txCountMap[idx].toString(), 2)

    amountTotal = bns.add(amountTotal, amountBtc)
    grandTotalAmount = bns.add(grandTotalAmount, amountBtc)
    revTotal = bns.add(revTotal, rev)

    if (currencyAmountMap[idx][tx.inputCurrency] === undefined) {
      currencyAmountMap[idx][tx.inputCurrency] = '0'
    }

    if (currencyAmountMap[idx][tx.outputCurrency] === undefined) {
      currencyAmountMap[idx][tx.outputCurrency] = '0'
    }

    const halfAmount = bns.div(amountUsd, '2', 2)

    currencyAmountMap[idx][tx.inputCurrency] = bns.add(
      currencyAmountMap[idx][tx.inputCurrency],
      halfAmount
    )
    currencyAmountMap[idx][tx.outputCurrency] = bns.add(
      currencyAmountMap[idx][tx.outputCurrency],
      halfAmount
    )
  }

  for (const d in txCountMap) {
    if (txCountMap.hasOwnProperty(d)) {
      const avgBtc = bns.div(avgBtcMap[d], '1', 6)
      const avgUsd = bns.div(avgUsdMap[d], '1', 2)
      const amtBtc = bns.div(amountBtcMap[d], '1', 6)
      const amtUsd = bns.div(amountUsdMap[d], '1', 2)
      // const c = padSpace(txCountMap[d], 3)

      let currencyAmounts = ''

      const currencyAmountArray = []
      for (const c in currencyAmountMap[d]) {
        currencyAmountArray.push({ code: c, amount: currencyAmountMap[d][c] })
      }
      currencyAmountArray.sort((a, b) => {
        return bns.lt(a.amount, b.amount) ? 1 : -1
      })

      let i = 0
      for (const c of currencyAmountArray) {
        let a = c.amount
        a = bns.div(a, '1', 2)
        currencyAmounts += `${c.code}:${a} `
        i++
        if (i > 5) break
      }

      const l = sprintf(
        '%s %s: %2s txs, %7.2f avgUSD, %1.5f avgBTC, %9.2f amtUSD, %2.5f amtBTC, %s',
        prefix,
        d,
        txCountMap[d],
        parseFloat(avgUsd),
        parseFloat(avgBtc),
        parseFloat(amtUsd),
        parseFloat(amtBtc),
        currencyAmounts
      )
      console.log(l)
      // console.log(`${d} txs:${c} - avgUSD:${avgUsd} - avgBTC:${avgBtc} - amtUSD:${amtUsd} - amtBTC:${amtBtc}`)
    }
  }

  // console.log(txCountMap)
  // console.log(amountBtcMap)
  // console.log(avgBtcMap)
  console.log(
    'avg tx size: ' +
      (parseInt(grandTotalAmount) / cachedTransactions.length).toString()
  )
}

module.exports = { checkSwapService }
