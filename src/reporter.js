// @flow
import type { SwapFuncParams, TxDataMap } from './checkSwapService.js'
const { doShapeShift, isConfigValid: isConfigValidShapeShift } = require('./shapeshift.js')
const { doChangelly, isConfigValid: isConfigValidChangelly } = require('./changelly.js')
const { doLibertyX, isConfigValid: isConfigValidLibertyx } = require('./libertyx.js')
const { doChangenow, isConfigValid: isConfigValidChangenow } = require('./changenow.js')
const { doBitrefill, isConfigValid: isConfigValidBitrefill } = require('./bitrefill.js')
const { doTotle, isConfigValid: isConfigValidTotle } = require('./totle.js')
const { doFox, isConfigValid: isConfigValidFox } = require('./fox.js')
const { doFaast, isConfigValid: isConfigValidFaast } = require('./faast.js')
const { doMoonpay, isConfigValid: isConfigValidMoonpay } = require('./moonpay.js')
const { sprintf } = require('sprintf-js')
const { bns } = require('biggystring')

async function main (swapFuncParams: SwapFuncParams) {
  await printDataOrError(swapFuncParams, doChangelly, 'CHA', isConfigValidChangelly)
  await printDataOrError(swapFuncParams, doShapeShift, 'SSH', isConfigValidShapeShift)
  await printDataOrError(swapFuncParams, doLibertyX, 'LBX', isConfigValidLibertyx)
  await printDataOrError(swapFuncParams, doChangenow, 'CHN', isConfigValidChangenow)
  await printDataOrError(swapFuncParams, doFaast, 'FAA', isConfigValidFaast)
  await printDataOrError(swapFuncParams, doBitrefill, 'BIT', isConfigValidBitrefill)
  await printDataOrError(swapFuncParams, doTotle, 'TOT', isConfigValidTotle)
  await printDataOrError(swapFuncParams, doFox, 'FOX', isConfigValidFox)
  await printDataOrError(swapFuncParams, doMoonpay, 'MNP', isConfigValidMoonpay)
  console.log(new Date(Date.now()))
}

async function printDataOrError (swapFuncParams: SwapFuncParams, doFunction: Function, svcName: string, isConfigValid: boolean) {
  if (isConfigValid) {
    const data = await doFunction(swapFuncParams)
    return printTxDataMap(svcName, data)
  } else {
    printNotConfigured(svcName)
    return Promise.resolve()
  }
}

function makeDate (endTime) {
  const end = new Date(endTime)
  const y = end.getUTCFullYear().toString()
  let m = (end.getUTCMonth() + 1).toString()
  if (m.length < 2) m = `0${m}`
  let d = end.getUTCDate().toString()
  if (d.length < 2) d = `0${d}`
  return `${y}-${m}-${d}`
}

function combineResults (r1: { [string]: TxDataMap }, r2: { [string]: TxDataMap }) {
  for (const freq in r2) {
    if (r2.hasOwnProperty(freq)) {
      if (!r1[freq]) {
        r1[freq] = {}
      }
      combineTxDataMap(r1[freq], r2[freq])
    }
  }
}

function combineTxDataMap (r1: TxDataMap, r2: TxDataMap) {
  for (const date in r2) {
    if (r2.hasOwnProperty(date)) {
      if (!r1[date]) {
        r1[date] = {
          txCount: 0,
          amountBtc: '0',
          amountUsd: '0',
          currencyAmount: {}
        }
      }
      // Combine each field
      r1[date].txCount = r1[date].txCount + r2[date].txCount
      r1[date].amountBtc = bns.add(r1[date].amountBtc, r2[date].amountBtc)
      r1[date].amountUsd = bns.add(r1[date].amountUsd, r2[date].amountUsd)
      for (const cc in r2[date].currencyAmount) {
        if (r1[date].currencyAmount[cc]) {
          r1[date].currencyAmount[cc] = bns.add(r1[date].currencyAmount[cc], r2[date].currencyAmount[cc])
        } else {
          r1[date].currencyAmount[cc] = r2[date].currencyAmount[cc]
        }
      }
    }
  }
}

async function doSummaryFunction (doFunction: Function): { [string]: TxDataMap } {
  // console.log(new Date(Date.now()))
  // console.log('**************************************************')
  // console.log('******* Monthly')
  // console.log(`******* Monthly until 2018-01`)
  const out = {
    monthly: {},
    daily: {},
    hourly: {}
  }

  out.monthly = await doFunction({useCache: false, interval: 'month', endDate: '2018-01'})

  // console.log('**************************************************')
  let end = Date.now() - 1000 * 60 * 60 * 24 * 60 // 60 days back
  let endDate = makeDate(end)
  // console.log(`******* Daily until ${endDate}`)
  out.daily = await doFunction({useCache: true, interval: 'day', endDate})

  // console.log('**************************************************')
  end = Date.now() - 1000 * 60 * 60 * 24 * 2 // 2 days back
  endDate = makeDate(end)
  // console.log(`******* Hourly until ${endDate}`)
  out.hourly = await doFunction({useCache: true, interval: 'hour', endDate})
  return out
}

// called by './report summary' from command line
async function report (argv: Array<any>) {
  const d = new Date()
  console.log(d)
  console.log(d.toDateString() + ' ' + d.toTimeString())

  const swapFuncParams: SwapFuncParams = {useCache: false, interval: 'month', endDate: '2018-01'}
  let doSummary = false
  for (const arg of argv) {
    if (arg === 'day' || arg === 'month' || arg === 'hour' || arg === 'mins') {
      swapFuncParams.interval = arg
    } else if (arg === 'cache') {
      swapFuncParams.useCache = true
    } else if (arg === 'summary') { // most common parameter
      doSummary = true
      break
    } else if (arg === 'nocache') {
      swapFuncParams.useCache = false
    }

    if (process.argv.length === 5) {
      swapFuncParams.endDate = process.argv[4]
    }
  }

  if (doSummary) {
    const results: { [string]: TxDataMap } = {}

    if (isConfigValidChangenow) {
      const doResults = await doSummaryFunction(doChangenow)
      combineResults(results, doResults)
      console.log('\n***** Change NOW Daily *****')
      printTxDataMap('CHN', doResults.daily)
    } else {
      printNotConfigured('CHA')
    }

    if (isConfigValidChangelly) {
      const doResults = await doSummaryFunction(doChangelly)
      combineResults(results, doResults)
      console.log('\n***** Changelly Daily *****')
      printTxDataMap('CHA', doResults.daily)
      console.log('\n***** Changelly Monthly *****')
      printTxDataMap('CHA', doResults.monthly)
    } else {
      printNotConfigured('CHA')
    }

    if (isConfigValidFaast) {
      const doResults = await doSummaryFunction(doFaast)
      combineResults(results, doResults)
      console.log('\n***** Faast Daily *****')
      printTxDataMap('FAA', doResults.daily)
    } else {
      printNotConfigured('FAA')
    }

    if (isConfigValidFox) {
      const doResults = await doSummaryFunction(doFox)
      combineResults(results, doResults)
      console.log('\n***** fox.exchange Daily *****')
      printTxDataMap('', doResults.daily)
    } else {
      printNotConfigured('FOX')
    }

    if (isConfigValidShapeShift) {
      const doResults = await doSummaryFunction(doShapeShift)
      combineResults(results, doResults)
      console.log('\n***** Shapeshift Daily *****')
      printTxDataMap('SSH', doResults.daily)
      console.log('\n***** Shapeshift Monthly *****')
      printTxDataMap('SSH', doResults.monthly)
    } else {
      printNotConfigured('SSH')
    }

    if (isConfigValidLibertyx) {
      const doResults = await doSummaryFunction(doLibertyX)
      combineResults(results, doResults)
      console.log('\n***** Libertyx Monthly *****')
      printTxDataMap('LBX', doResults.monthly)
      console.log('\n***** Libertyx Daily *****')
      printTxDataMap('LBX', doResults.daily)
    } else {
      printNotConfigured('LBX')
    }

    if (isConfigValidBitrefill) {
      const doResults = await doSummaryFunction(doBitrefill)
      combineResults(results, doResults)
      console.log('\n***** Bitrefill Monthly *****')
      printTxDataMap('BIT', doResults.monthly)
      console.log('\n***** Bitrefill Daily *****')
      printTxDataMap('BIT', doResults.daily)
    } else {
      printNotConfigured('BIT')
    }

    if (isConfigValidTotle) {
      const doResults = await doSummaryFunction(doTotle)
      combineResults(results, doResults)
      console.log('\n***** Totle Daily *****')
      printTxDataMap('TOT', doResults.daily)
    } else {
      printNotConfigured('TOT')
    }

    if (isConfigValidMoonpay) {
      const doResults = await doSummaryFunction(doMoonpay)
      combineResults(results, doResults)
      console.log('\n***** Moonpay Daily *****')
      printTxDataMap('', doResults.daily)
    } else {
      printNotConfigured('MNP')
    }

    console.log('\n***** Swap Totals Monthly*****')
    printTxDataMap('TTS', results.monthly)
    console.log('\n***** Swap Totals Daily *****')
    printTxDataMap('TTS', results.daily)
    console.log('\n***** Swap Totals Hourly *****')
    printTxDataMap('TTS', results.hourly)
    console.log('\n***** Grand Totals Monthly *****')
    printTxDataMap('TTL', results.monthly)
    console.log('\n***** Grand Totals Daily *****')
    printTxDataMap('TTL', results.daily)
    console.log('\n***** Grand Totals Hourly *****')
    printTxDataMap('TTL', results.hourly)
    const d = new Date()
    console.log(d)
    console.log(d.toDateString() + ' ' + d.toTimeString())
  } else {
    await main(swapFuncParams)
  }
}

function printNotConfigured (svcName: string) {
  console.log(`\n***** ${svcName} Not Configured *****`)
}

function printTxDataMap (prefix: string, txDataMap: TxDataMap) {
  // Sort results first
  const txDataArray = []
  for (const d in txDataMap) {
    if (txDataMap.hasOwnProperty(d)) {
      txDataArray.push({
        date: d,
        ...txDataMap[d]
      })
    }
  }
  txDataArray.sort((a, b) => {
    const a1 = parseInt(a.date.replace(/-/g, ''))
    const b1 = parseInt(b.date.replace(/-/g, ''))
    const out = b1 - a1
    // console.log(`${a1} < ${b1} = ${out.toString()}`)
    return out
    // return a1 < b1
    // return a.date < b.date
    // return parseInt(a.date.replace(/-/g, '')) < parseInt(b.date.replace(/-/g, ''))
  })

  for (const d of txDataArray) {
    const avgBtc = bns.div(d.amountBtc, d.txCount.toString(), 3)
    const avgUsd = bns.div(d.amountUsd, d.txCount.toString(), 0)
    const amtBtc = bns.div(d.amountBtc, '1', 3)
    const amtUsd = bns.div(d.amountUsd, '1', 0)
    // const c = padSpace(txCountMap[d], 3)

    let currencyAmounts = ''

    const currencyAmountArray = []
    for (const c in d.currencyAmount) {
      currencyAmountArray.push({ code: c, amount: d.currencyAmount[c] })
    }
    currencyAmountArray.sort((a, b) => {
      return bns.lt(a.amount, b.amount) ? 1 : -1
    })

    let i = 0
    for (const c of currencyAmountArray) {
      let a = c.amount
      a = bns.div(a, '1', 0)
      currencyAmounts += `${c.code}:${a} `
      i++
      if (i > 12) break
    }

    const l = sprintf(
      '%s %s: %4s txs, %5.0f avgUSD, %5.2f avgBTC, %6.0f USD, %5.2f BTC, %s',
      prefix,
      d.date,
      d.txCount,
      parseFloat(avgUsd),
      parseFloat(avgBtc),
      parseFloat(amtUsd),
      parseFloat(amtBtc),
      currencyAmounts
    )
    console.log(l)
  }
}

module.exports = { report }
