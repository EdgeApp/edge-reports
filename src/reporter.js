// @flow

const fetch = require('node-fetch')
const js = require('jsonfile')
const { bns } = require('biggystring')
// const sleep = require('await-sleep')
// const fs = require('fs')

const confFileName = './config.json'
const config = js.readFileSync(confFileName)
const interval = config.timeInterval

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

const ratePairs: {[pair: string]: string} = {}

async function getRate (pair: string): string {
  if (ratePairs[pair] !== undefined) {
    return ratePairs[pair]
  }
  const request = `https://shapeshift.io/rate/${pair}`

  let response
  try {
    response = await fetch(request)
  } catch (e) {
    console.log(e)
    return ''
  }
  let jsonObj = await response.json()

  if (typeof jsonObj.rate === 'string') {
    ratePairs[pair] = jsonObj.rate
    return ratePairs[pair]
  } else {
    return ''
  }
}

function daydiff(first, second) {
  return Math.round((second-first)/(1000*60*60*24))
}

async function doShapeShift () {
  const apiKey = config.shapeShiftApiKey
  const request = `https://shapeshift.io/txbyapikey/${apiKey}`
  console.log(request)
  let response
  let jsonObj = []
  while (jsonObj.length === 0) {
    try {
      response = await fetch(request)
    } catch (e) {
      console.log(e)
      return
    }
    jsonObj = await response.json()
  }

  console.log('Number of transactions:' + jsonObj.length.toString())

  let txCountMap: {[date: string]: number} = {}
  let avgMap: {[date: string]: number} = {}
  let amountMap:  {[date: string]: string} = {}
  let revMap: {[date: string]: string} = {}
  let amountTotal = '0'
  let revTotal = '0'
  let dateNow = Date.now()
  let grandTotalAmount = '0'
  const rates = {}
  for (const tx: ShapeShiftTx of jsonObj) {
    const date: Date = new Date(tx.timestamp * 1000)
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1, 2)
    const day = pad(date.getDate(), 2)
    const hour = pad(date.getHours(), 2)

    let idx
    if (interval === 'day') {
      idx = `${year}-${month}-${day}`
    } else if (interval === 'month') {
      idx = `${year}-${month}`
    } else if (interval === 'hour') {
      idx = `${year}-${month}-${day}-${hour}`
    } else {
      idx = `${year}-${month}`
    }

    if (txCountMap[idx] === undefined) {
      txCountMap[idx] = 0
      amountMap[idx] = '0'
      revMap[idx] = '0'
      avgMap[idx] = '0'
    }
    txCountMap[idx]++

    let amountBtc: string = '0'
    if (tx.inputCurrency === 'BTC') {
      amountBtc = tx.inputAmount.toString()
    } else {
      let rate = rates[`${tx.inputCurrency}_btc`]
      if (!rate) {
        rate = await getRate(`${tx.inputCurrency}_btc`)
      }
      amountBtc = bns.mul(rate, tx.inputAmount.toString())
    }
    amountMap[idx] = bns.add(amountMap[idx], amountBtc)
    const rev = bns.mul(amountBtc, '0.0025')
    revMap[idx] = bns.add(revMap[idx], rev)
    avgMap[idx] = bns.div(amountMap[idx], txCountMap[idx].toString(), 4)

    amountTotal = bns.add(amountTotal, amountBtc)
    grandTotalAmount = bns.add(grandTotalAmount, amountBtc)
    revTotal = bns.add(revTotal, rev)

    // if (daydiff(tx.timestamp * 1000, dateNow) > 60) {
      // dateNow = tx.timestamp * 1000
      // console.log('txCountMap:', txCountMap)
      // console.log('amountMap:', amountMap)
      // console.log('revMap:', revMap)
      // console.log('amountTotal: ' + amountTotal)
      // console.log('revTotal: ' + revTotal)
      // txCountMap = {}
      // amountMap = {}
      // revMap = {}
      // amountTotal = '0'
      // revTotal = '0'
    // }
  }

  for (const d in txCountMap) {
    if (txCountMap.hasOwnProperty(d)) {
      const c = padSpace(txCountMap[d], 3)
      const a = padRight(avgMap[d], 6)
      console.log(`${d} txs:${c} - avg:${a} - amt:${amountMap[d]}`)
    }
  }

  // console.log(txCountMap)
  // console.log(amountMap)
  // console.log(avgMap)
  console.log('avg tx size: ' + (parseInt(grandTotalAmount) / jsonObj.length).toString())
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
}

main()
