// @flow

const fetch = require('node-fetch')
const js = require('jsonfile')
const { bns } = require('biggystring')
const { sprintf } = require('sprintf-js')
const jsonFormat = require('json-format')
const fs = require('fs')

const confFileName = './config.json'
const config = js.readFileSync(confFileName)
let interval = config.timeInterval
let useCache = false
let doSummary = false
const cacheFile = './ssRaw.json'

const jsonConfig = {
  type: 'space',
  size: 2
}

for (const arg of process.argv) {
  if (
    arg === 'day' ||
    arg === 'month' ||
    arg === 'hour' ||
    arg === 'mins') {
    interval = arg
  } else if (arg === 'cache') {
    useCache = true
  } else if (arg === 'summary') {
    doSummary = true
    break
  } else if (arg === 'nocache') {
    useCache = false
  }

  if (process.argv.length === 5) {
    config.endDate = process.argv[4]
  }
}

type ShapeShiftTx = {
  inputTXID: string,
  inputAddress: string,
  inputCurrency: string,
  inputAmount: number,
  outputAddress: string,
  outputCurrency: string,
  status: string, // complete,
  timestamp: number,
  hasConfirmations: boolean,
  outputTXID: string,
  outputAmount: string,
  shiftRate: string
}

function pad (num, size) {
  let s = num + '';
  while (s.length < size) {
    s = '0' + s
  }
  return s
}

function padRight (num, size) {
  let s = num + '';
  while (s.length < size) {
    s = s + '0'
  }
  return s
}

function padSpace (num, size) {
  let s = num + '';
  while (s.length < size) {
    s = ' ' + s
  }
  return s
}

let ratePairs: {[date: string]: {[code: string]: string}} = {}
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
  if (!doSummary) {
    console.log(url)
  }
  let response
  try {
    response = await fetch(url,
      {
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
    if (!doSummary) {
      console.log(e)
    }
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

async function getRate (opts: GetRateOptions): string {
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
      const request = `https://shapeshift.io/rate/${pair}`
      const response = await fetch(request)
      const jsonObj = await response.json()
      const rate = jsonObj.rate.toString()
      btcRates[pair] = rate
      js.writeFileSync('./btcRates.json', btcRates)
      return rate
    } catch (e) {
      throw e
    }
  }
}

function daydiff(first, second) {
  return Math.round((second-first)/(1000*60*60*24))
}

async function doShapeShift () {
  clearCache()
  const cachedTransactions = js.readFileSync(cacheFile)
  let newTransactions = []
  if (!useCache) {
    const apiKey = config.shapeShiftApiKey
    const request = `https://shapeshift.io/txbyapikeylimit/${apiKey}/500`
    if (!doSummary) {
      console.log(request)
    }
    while (newTransactions.length === 0) {
      let response
      try {
        response = await fetch(request)
        newTransactions = await response.json()
      } catch (e) {
        console.log(e)
        return
      }
    }
  }

  // Find duplicates
  let numAdded = 0
  for (const newTx of newTransactions) {
    let match = false
    for (const oldTx of cachedTransactions) {
      if (oldTx.inputTXID === newTx.inputTXID) {
        match = true
        break
      }
    }
    if (!match) {
      cachedTransactions.push(newTx)
      numAdded++  
    }
  }
  cachedTransactions.sort((a, b) => {
    return b.timestamp - a.timestamp
  })

  if (!doSummary) {
    console.log('Number of downloaded transactions: ' + newTransactions.length.toString())
    console.log('Number of new transactions: ' + numAdded.toString())  
  }

  const out = jsonFormat(cachedTransactions, jsonConfig)
  fs.writeFileSync('./ssRaw.json', out)

  let txCountMap: {[date: string]: number} = {}
  let avgBtcMap: {[date: string]: string} = {}
  let avgUsdMap: {[date: string]: string} = {}
  let currencyAmountMap : {[date: string]: {[currencyCode: string]: string}} = {}
  let amountBtcMap:  {[date: string]: string} = {}
  let amountUsdMap:  {[date: string]: string} = {}
  let revMap: {[date: string]: string} = {}
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
        from: tx.inputCurrency, to:'BTC', year: year.toString(), month, day
      })
      amountBtc = bns.mul(rate, tx.inputAmount.toString())
    }
    const btcRate = await getPairCached('BTC', `${year.toString()}-${month}-${day}`)
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

    currencyAmountMap[idx][tx.inputCurrency] = bns.add(currencyAmountMap[idx][tx.inputCurrency], halfAmount)
    currencyAmountMap[idx][tx.outputCurrency] = bns.add(currencyAmountMap[idx][tx.outputCurrency], halfAmount)
  }

  for (const d in txCountMap) {
    if (txCountMap.hasOwnProperty(d)) {
      let avgBtc = bns.div(avgBtcMap[d], '1', 6)
      let avgUsd = bns.div(avgUsdMap[d], '1', 2)
      let amtBtc = bns.div(amountBtcMap[d], '1', 6)
      let amtUsd = bns.div(amountUsdMap[d], '1', 2)
      // const c = padSpace(txCountMap[d], 3)

      let currencyAmounts = ''

      let currencyAmountArray = []
      for (const c in currencyAmountMap[d]) {
        currencyAmountArray.push({code: c, amount: currencyAmountMap[d][c]})
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

      const l = sprintf('%s: %2s txs, %7.2f avgUSD, %1.5f avgBTC, %9.2f amtUSD, %2.5f amtBTC, %s', d, txCountMap[d], parseFloat(avgUsd), parseFloat(avgBtc), parseFloat(amtUsd), parseFloat(amtBtc), currencyAmounts)
      console.log(l)
      // console.log(`${d} txs:${c} - avgUSD:${avgUsd} - avgBTC:${avgBtc} - amtUSD:${amtUsd} - amtBTC:${amtBtc}`)
    }
  }

  // console.log(txCountMap)
  // console.log(amountBtcMap)
  // console.log(avgBtcMap)
  console.log('avg tx size: ' + (parseInt(grandTotalAmount) / cachedTransactions.length).toString())
}

async function doLibertyX () {
  const apiKey = config.libertyXApiKey
  const request = `https://libertyx.com/airbitz/stats`
  console.log(request)
  let response
  try {
    response = await fetch(request, {
      headers: {
        Authorization: `${apiKey}`
      },
      method: 'POST'
    })
  } catch (e) {
    console.log(e)
    return
  }
  let jsonObj = await response.json()
  let numTx = 0
  let newAmt = 0
  let oldAmt = 0
  for (const day of jsonObj.stats) {
    let a = 0, n = 0, o = 0
    if (day.all_transactions_count) {
      numTx += day.all_transactions_count
    }
    if (day.all_transactions_usd_sum) {
      a = day.all_transactions_usd_sum
    }
    if (day.first_transactions_usd_sum) {
      n = day.first_transactions_usd_sum
    }
    oldAmt += a - n
    newAmt += n
  }
  console.log('Number of transactions:' + numTx.toString())
  console.log('Total new revenue:' + newAmt.toString())
  console.log('Total old revenue:' + oldAmt.toString())
}

async function main () {
  await doShapeShift()
  await doLibertyX()
  console.log(new Date(Date.now()))
}

function makeDate (endTime) {
  const end = new Date(endTime)
  const y = (end.getUTCFullYear()).toString()
  let m = (end.getUTCMonth() + 1).toString()
  if (m.length < 2) m = `0${m}`
  let d = (end.getUTCDate()).toString()
  if (d.length < 2) d = `0${d}`
  return `${y}-${m}-${d}`
}

async function doSummaryFunction () {
  console.log(new Date(Date.now()))
  console.log('**************************************************')
  console.log('******* Monthly')
  useCache = false
  interval = 'month'
  config.endDate = '2018-01'
  console.log(`******* Monthly until ${config.endDate}`)
  await doShapeShift()

  console.log('**************************************************')
  useCache = true
  interval = 'day'
  let end = Date.now() - (1000 * 60 * 60 * 24 * 30) // 30 days back
  config.endDate = makeDate(end)
  console.log(`******* Daily until ${config.endDate}`)
  await doShapeShift()

  console.log('**************************************************')
  useCache = true
  interval = 'hour'
  end = Date.now() - (1000 * 60 * 60 * 24 * 2) // 2 days back
  config.endDate = makeDate(end)
  console.log(`******* Hourly until ${config.endDate}`)
  await doShapeShift()
}

if (!doSummary) {
  main()
} else {
  doSummaryFunction()
}
