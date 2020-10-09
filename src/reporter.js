// @flow
import type { SwapFuncParams, TxDataMap } from './checkSwapService.js'
const { doShapeShift } = require('./shapeshift.js')
const { doChangelly } = require('./changelly.js')
const { doLibertyX } = require('./libertyx.js')
const { doChangenow } = require('./changenow.js')
const { doBitrefill } = require('./bitrefill.js')
const { doTotle } = require('./totle.js')
const { doFox } = require('./fox.js')
const { doFaast } = require('./faast.js')
const { doCoinswitch } = require('./coinswitch.js')
const { doMoonpay } = require('./moonpay.js')
const { doTransak } = require('./transak.js')
const { doWyre } = require('./wyre.js')
const { doBog } = require('./bitsOfGold.js')
const { doGodex } = require('./godex.js')
const { doSafello } = require('./safello.js')
const { doSimplex } = require('./simplex.js')
const { doBanxa } = require('./banxa.js')
const { doBity } = require('./bity.js')
const { doSwitchain } = require('./switchain.js')
const { doPaytrie } = require('./paytrie.js')
const { doSideShift } = require('./sideshift.js')
const { bns } = require('biggystring')
const config = require('../config.json')
const { sprintf } = require('sprintf-js')

async function main (swapFuncParams: SwapFuncParams) {
  const rChn = await doChangenow(swapFuncParams).catch(e => {
    console.error('doChangenow failed')
    return {}
  })
  const rTnk = await doTransak(swapFuncParams).catch(e => {
    console.error('doTransak failed')
    return {}
  })
  const rCha = await doChangelly(swapFuncParams).catch(e => {
    console.error('doChangelly failed')
    return {}
  })
  const rFaa = await doFaast(swapFuncParams).catch(e => {
    console.error('doFaast failed')
    return {}
  })
  const rSsh = await doShapeShift(swapFuncParams).catch(e => {
    console.error('doShapeShift failed')
    return {}
  })
  const rXai = await doSideShift(swapFuncParams).catch(e => {
    console.error('doSideShift failed')
    return {}
  })
  const rLbx = await doLibertyX(swapFuncParams).catch(e => {
    console.error('doLibertyX failed')
    return {}
  })
  const rBit = await doBitrefill(swapFuncParams).catch(e => {
    console.error('doBitrefill failed')
    return {}
  })
  const rFox = await doFox(swapFuncParams).catch(e => {
    console.error('doFox failed')
    return {}
  })
  const rTl = await doTotle(swapFuncParams).catch(e => {
    console.error('doTotle failed')
    return {}
  })
  const rCs = await doCoinswitch(swapFuncParams).catch(e => {
    console.error('doCoinswitch failed')
    return {}
  })
  const rGdx = await doGodex(swapFuncParams).catch(e => {
    console.error('GoDex failed')
    return {}
  })
  const rMnp = await doMoonpay(swapFuncParams).catch(e => {
    console.error('doMoonpay failed')
    return {}
  })
  const rWyr = await doWyre(swapFuncParams).catch(e => {
    console.error('doWyre failed')
    return {}
  })
  const rSaf = await doSafello(swapFuncParams).catch(e => {
    console.error('doSafello failed')
    return {}
  })

  const rBog = await doBog(swapFuncParams).catch(e => {
    console.error('doBitsOfGold failed')
    return {}
  })

  const rSim = await doSimplex(swapFuncParams).catch(e => {
    console.error('doSimplex failed')
    return {}
  })

  const rBan = await doBanxa(swapFuncParams).catch(e => {
    console.error('doBanxa failed')
    return {}
  })

  const rBity = await doBity(swapFuncParams).catch(e => {
    console.error('doBity failed')
    return {}
  })

  const rSwi = await doSwitchain(swapFuncParams).catch(e => {
    console.error('doSwitchain failed')
    return {}
  })

  const rPt = await doPaytrie(swapFuncParams).catch(e => {
    console.error('doPaytrie failed', e)
    return {}
  })

  printTxDataMap('CHN', rChn)
  printTxDataMap('CHA', rCha)
  printTxDataMap('FAA', rFaa)
  printTxDataMap('SSH', rSsh)
  printTxDataMap('XAI', rXai)
  printTxDataMap('LBX', rLbx)
  printTxDataMap('BIT', rBit)
  printTxDataMap('TOT', rTl)
  printTxDataMap('FOX', rFox)
  printTxDataMap('CS', rCs)
  printTxDataMap('GDX', rGdx)
  printTxDataMap('MNP', rMnp)
  printTxDataMap('TNK', rTnk)
  printTxDataMap('WYR', rWyr)
  printTxDataMap('SAF', rSaf)
  printTxDataMap('BOG', rBog)
  printTxDataMap('SIM', rSim)
  printTxDataMap('BAN', rBan)
  printTxDataMap('BITY', rBity)
  printTxDataMap('SWI', rSwi)
  printTxDataMap('PT', rPt)
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

function combineResults (
  r1: { [string]: TxDataMap },
  r2: { [string]: TxDataMap }
) {
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
          r1[date].currencyAmount[cc] = bns.add(
            r1[date].currencyAmount[cc],
            r2[date].currencyAmount[cc]
          )
        } else {
          r1[date].currencyAmount[cc] = r2[date].currencyAmount[cc]
        }
      }
    }
  }
}

async function doSummaryFunction (
  doFunction: Function
): { [string]: TxDataMap } {
  // console.log(new Date(Date.now()))
  // console.log('**************************************************')
  // console.log('******* Monthly')
  // console.log(`******* Monthly until 2018-01`)
  const out = {
    monthly: {},
    daily: {},
    hourly: {}
  }

  out.monthly = await doFunction({
    useCache: false,
    interval: 'month',
    endDate: '2018-01'
  }).catch(e => {
    console.error('doSummaryFunction (monthly) failed')
    return {}
  })

  // console.log('**************************************************')
  let end = Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 days back
  let endDate = makeDate(end)
  // console.log(`******* Daily until ${endDate}`)
  out.daily = await doFunction({ useCache: true, interval: 'day', endDate }).catch(e => {
    console.error('doSummaryFunction (daily) failed')
    return {}
  })

  // console.log('**************************************************')
  end = Date.now() - 1000 * 60 * 60 * 24 * 1 // 1 days back
  endDate = makeDate(end)
  // console.log(`******* Hourly until ${endDate}`)
  out.hourly = await doFunction({ useCache: true, interval: 'hour', endDate }).catch(e => {
    console.error('doSummaryFunction (hourly) failed')
    return {}
  })
  return out
}

// called by './report summary' from command line
async function report (argv: Array<any>) {
  const d = new Date()
  console.log(d)
  console.log(d.toDateString() + ' ' + d.toTimeString())

  const swapFuncParams: SwapFuncParams = {
    useCache: false,
    interval: 'month',
    endDate: '2018-01'
  }
  let doSummary = false
  for (const arg of argv) {
    if (arg === 'day' || arg === 'month' || arg === 'hour' || arg === 'mins') {
      swapFuncParams.interval = arg
    } else if (arg === 'cache') {
      swapFuncParams.useCache = true
    } else if (arg === 'summary') {
      // most common parameter
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
    const fiatResults: { [string]: TxDataMap } = {}

    // swaps (crypto-to-crypto)
    const cnResults = config.changenowApiKey
      ? await doSummaryFunction(doChangenow)
      : {}
    const chResults = config.changellyApiKey
      ? await doSummaryFunction(doChangelly)
      : {}
    const ssResults = config.shapeShiftToken
      ? await doSummaryFunction(doShapeShift)
      : {}
    const xaiResults = config.sideShiftAffiliateId
      ? await doSummaryFunction(doSideShift)
      : {}
    const faResults = config.faastAffiliateId
      ? await doSummaryFunction(doFaast)
      : {}
    const tlResults = config.totleApiKey ? await doSummaryFunction(doTotle) : {}
    const foxResults = config.foxCredentials
      ? await doSummaryFunction(doFox)
      : {}
    const csResults =
      config.coinswitch && config.coinswitch.apiKey
        ? await doSummaryFunction(doCoinswitch)
        : {}
    const gxResults =
      config.godex && config.godex.apiKey
        ? await doSummaryFunction(doGodex)
        : {}
    const swResults =
        config.switchainApiKey ? await doSummaryFunction(doSwitchain)
          : {}

    // non-swap (crypto-to-fiat and vice-versa)
    const lxResults = config.libertyXApiKey
      ? await doSummaryFunction(doLibertyX)
      : {}
    const btResults =
      config.bitrefillCredentials && config.bitrefillCredentials.apiKey
        ? await doSummaryFunction(doBitrefill)
        : {}
    const mnpResults = config.moonpayApiKey
      ? await doSummaryFunction(doMoonpay)
      : {}
    const tnkResults = config.transak_api_secret
      ? await doSummaryFunction(doTransak)
      : {}
    const wyrResults = config.wyre && config.wyre.periscopeClientKey
      ? await doSummaryFunction(doWyre)
      : {}
    const safResults = config.safello && config.safello.apiKey
      ? await doSummaryFunction(doSafello)
      : {}
    const bogResults = config.bog && config.bog.apiKey
      ? await doSummaryFunction(doBog)
      : {}
    const ptResults =
      config.paytrieCredentials && config.paytrieCredentials.apiKey
        ? await doSummaryFunction(doPaytrie)
        : {}

    const simResults = await doSummaryFunction(doSimplex)
    const banResults = await doSummaryFunction(doBanxa)
    const bityResults = await doSummaryFunction(doBity)

    combineResults(results, cnResults)
    combineResults(results, chResults)
    combineResults(results, faResults)
    combineResults(results, ssResults)
    combineResults(results, xaiResults)
    combineResults(results, tlResults)
    combineResults(results, foxResults)
    combineResults(results, csResults)
    combineResults(results, gxResults)
    combineResults(results, swResults)

    console.log('\n***** Change NOW Daily *****')
    printTxDataMap('CHN', cnResults.daily)
    console.log('\n***** Change NOW monthly *****')
    printTxDataMap('CHN', cnResults.monthly)

    console.log('\n***** Changelly Daily *****')
    printTxDataMap('CHA', chResults.daily)
    console.log('\n***** Changelly Monthly *****')
    printTxDataMap('CHA', chResults.monthly)

    console.log('\n***** Faast Daily *****')
    printTxDataMap('FAA', faResults.daily)
    console.log('\n***** Faast Monthly *****')
    printTxDataMap('FAA', faResults.monthly)

    console.log('\n***** fox.exchange Daily *****')
    printTxDataMap('FOX', foxResults.daily)
    console.log('\n***** fox.exchange Monthly *****')
    printTxDataMap('FOX', foxResults.monthly)

    console.log('\n***** Shapeshift Daily *****')
    printTxDataMap('SSH', ssResults.daily)
    console.log('\n***** Shapeshift Monthly *****')
    printTxDataMap('SSH', ssResults.monthly)

    console.log('\n***** SideShift.ai Daily *****')
    printTxDataMap('XAI', xaiResults.daily)
    console.log('\n***** SideShift.ai Monthly *****')
    printTxDataMap('XAI', xaiResults.monthly)

    console.log('\n***** Coinswitch Daily *****')
    printTxDataMap('CS', csResults.daily)
    console.log('\n***** Coinswitch Monthly *****')
    printTxDataMap('CS', csResults.monthly)

    console.log('\n***** Totle Daily *****')
    printTxDataMap('TOT', tlResults.daily)
    console.log('\n***** Totle Monthly *****')
    printTxDataMap('TOT', tlResults.monthly)

    console.log('\n***** GoDex Daily *****')
    printTxDataMap('GX', gxResults.daily)
    console.log('\n***** GoDex Monthly *****')
    printTxDataMap('GX', gxResults.monthly)

    console.log('\n***** Switchain Daily *****')
    printTxDataMap('SWI', swResults.daily)
    console.log('\n***** Switchain Monthly *****')
    printTxDataMap('SWI', swResults.monthly)

    console.log('\n***** Libertyx Daily *****')
    printTxDataMap('LBX', lxResults.daily)
    console.log('\n***** Libertyx Monthly *****')
    printTxDataMap('LBX', lxResults.monthly)

    console.log('\n***** Bitrefill Daily *****')
    printTxDataMap('BIT', btResults.daily)
    console.log('\n***** Bitrefill Monthly *****')
    printTxDataMap('BIT', btResults.monthly)

    console.log('\n***** Moonpay Monthly *****')
    printTxDataMap('MNP', mnpResults.monthly)
    console.log('\n***** Moonpay Daily *****')
    printTxDataMap('MNP', mnpResults.daily)

    console.log('\n***** Transak Monthly *****')
    printTxDataMap('TNK', tnkResults.monthly)
    console.log('\n***** Transak Daily *****')
    printTxDataMap('TNK', tnkResults.daily)

    console.log('\n***** Wyre Monthly *****')
    printTxDataMap('WYR', wyrResults.monthly)
    console.log('\n***** Wyre Daily *****')
    printTxDataMap('WYR', wyrResults.daily)

    console.log('\n***** Safello Monthly *****')
    printTxDataMap('SAF', safResults.monthly)
    console.log('\n***** Safello Daily *****')
    printTxDataMap('SAF', safResults.daily)

    console.log('\n***** Bits of Gold Monthly *****')
    printTxDataMap('BOG', bogResults.monthly)
    console.log('\n***** Bits of Gold Daily *****')
    printTxDataMap('BOG', bogResults.daily)

    console.log('\n***** Simplex Monthly *****')
    printTxDataMap('SIM', simResults.monthly)
    console.log('\n***** Simplex Daily *****')
    printTxDataMap('SIM', simResults.daily)

    console.log('\n***** Banxa Monthly *****')
    printTxDataMap('BAN', banResults.monthly)
    console.log('\n***** Banxa Daily *****')
    printTxDataMap('BAN', banResults.daily)

    console.log('\n***** Bity Monthly *****')
    printTxDataMap('BITY', bityResults.monthly)
    console.log('\n***** Bity Daily *****')
    printTxDataMap('BITY', bityResults.daily)

    console.log('\n***** Paytrie Monthly *****')
    printTxDataMap('PT', ptResults.monthly)
    console.log('\n***** Transak Daily *****')
    printTxDataMap('PT', ptResults.daily)

    console.log('\n***** Swap Totals Monthly*****')
    printTxDataMap('TTS', results.monthly)
    console.log('\n***** Swap Totals Daily *****')
    printTxDataMap('TTS', results.daily)
    console.log('\n***** Swap Totals Hourly *****')
    printTxDataMap('TTS', results.hourly)

    combineResults(fiatResults, lxResults)
    combineResults(fiatResults, btResults)
    combineResults(fiatResults, mnpResults)
    combineResults(fiatResults, tnkResults)
    combineResults(fiatResults, wyrResults)
    combineResults(fiatResults, safResults)
    combineResults(fiatResults, bogResults)
    combineResults(fiatResults, simResults)
    combineResults(fiatResults, banResults)
    combineResults(fiatResults, bityResults)
    combineResults(fiatResults, ptResults)

    console.log('\n***** Fiat Totals Monthly *****')
    printTxDataMap('TTF', fiatResults.monthly)
    console.log('\n***** Fiat Totals Daily *****')
    printTxDataMap('TTF', fiatResults.daily)

    combineResults(results, fiatResults)

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
