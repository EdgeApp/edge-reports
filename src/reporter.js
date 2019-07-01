// @flow
import type { SwapFuncParams, TxDataMap } from './checkSwapService.js'
const { doShapeShift } = require('./shapeshift.js')
const { doChangelly } = require('./changelly.js')
const { doLibertyX } = require('./libertyx.js')
const { doChangenow } = require('./changenow.js')
const { doBitrefill } = require('./bitrefill.js')
const { doFaast } = require('./faast.js')
const { sprintf } = require('sprintf-js')
const { bns } = require('biggystring')
const config = require('../config.json')

async function main (swapFuncParams: SwapFuncParams) {
  const rChn = await doChangenow(swapFuncParams)
  const rCha = await doChangelly(swapFuncParams)
  const rFaa = await doFaast(swapFuncParams)
  const rSsh = await doShapeShift(swapFuncParams)
  const rLbx = await doLibertyX(swapFuncParams)
  const rBit = await doBitrefill(swapFuncParams)
  printTxDataMap('CHN', rChn)
  printTxDataMap('CHA', rCha)
  printTxDataMap('FAA', rFaa)
  printTxDataMap('SSH', rSsh)
  printTxDataMap('LBX', rLbx)
  printTxDataMap('BIT', rBit)
  console.log(new Date(Date.now()))
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
    const cnResults = config.changenowApiKey ? await doSummaryFunction(doChangenow) : {}
    const chResults = config.changellyApiKey ? await doSummaryFunction(doChangelly) : {}
    const ssResults = config.shapeShiftApiKey ? await doSummaryFunction(doShapeShift) : {}
    const faResults = config.faastAffiliateId ? await doSummaryFunction(doFaast) : {}
    combineResults(results, cnResults)
    combineResults(results, chResults)
    combineResults(results, faResults)
    combineResults(results, ssResults)
    const lxResults = config.libertyXApiKey ? await doSummaryFunction(doLibertyX) : {}
    const btResults = config.bitrefillCredentials.apiKey ? await doSummaryFunction(doBitrefill) : {}
    console.log('\n***** Change NOW Daily *****')
    printTxDataMap('CHN', cnResults.daily)
    console.log('\n***** Changelly Daily *****')
    printTxDataMap('CHA', chResults.daily)
    console.log('\n***** Faast Daily *****')
    printTxDataMap('FAA', faResults.daily)
    console.log('\n***** Shapeshift Daily *****')
    printTxDataMap('SSH', ssResults.daily)
    console.log('\n***** Libertyx Monthly *****')
    printTxDataMap('LBX', lxResults.monthly)
    console.log('\n***** Libertyx Daily *****')
    printTxDataMap('LBX', lxResults.daily)
    console.log('\n***** Bitrefill Monthly *****')
    printTxDataMap('BIT', btResults.monthly)
    console.log('\n***** Bitrefill Daily *****')
    printTxDataMap('BIT', btResults.daily)
    console.log('\n***** Swap Totals Monthly*****')
    printTxDataMap('TTS', results.monthly)
    console.log('\n***** Swap Totals Daily *****')
    printTxDataMap('TTS', results.daily)
    console.log('\n***** Swap Totals Hourly *****')
    printTxDataMap('TTS', results.hourly)
    combineResults(results, lxResults)
    combineResults(results, btResults)
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
    const avgBtc = bns.div(d.amountBtc, d.txCount.toString(), 6)
    const avgUsd = bns.div(d.amountUsd, d.txCount.toString(), 2)
    const amtBtc = bns.div(d.amountBtc, '1', 6)
    const amtUsd = bns.div(d.amountUsd, '1', 2)
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
      a = bns.div(a, '1', 2)
      currencyAmounts += `${c.code}:${a} `
      i++
      if (i > 5) break
    }

    const l = sprintf(
      '%s %s: %4s txs, %8.2f avgUSD, %2.5f avgBTC, %9.2f USD, %2.5f BTC, %s',
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
