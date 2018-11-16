// @flow
import type { SwapFuncParams } from './checkSwapService.js'
const fetch = require('node-fetch')
const js = require('jsonfile')
const { doShapeShift } = require('./shapeshift.js')
const { doChangelly } = require('./changelly.js')
const confFileName = './config.json'
const config = js.readFileSync(confFileName)

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
  const jsonObj = await response.json()
  let numTx = 0
  let newAmt = 0
  let oldAmt = 0
  for (const day of jsonObj.stats) {
    let a = 0
    let n = 0
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

async function main (swapFuncParams: SwapFuncParams) {
  await doShapeShift(swapFuncParams)
  await doChangelly(swapFuncParams)
  await doLibertyX()
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

async function doSummaryFunction (doFunction: Function) {
  console.log(new Date(Date.now()))
  console.log('**************************************************')
  console.log('******* Monthly')
  console.log(`******* Monthly until 2018-01`)
  await doFunction({useCache: false, interval: 'month', endDate: '2018-01'})

  console.log('**************************************************')
  let end = Date.now() - 1000 * 60 * 60 * 24 * 30 // 30 days back
  let endDate = makeDate(end)
  console.log(`******* Daily until ${endDate}`)
  await doFunction({useCache: true, interval: 'day', endDate})

  console.log('**************************************************')
  end = Date.now() - 1000 * 60 * 60 * 24 * 2 // 2 days back
  endDate = makeDate(end)
  console.log(`******* Hourly until ${endDate}`)
  await doFunction({useCache: true, interval: 'hour', endDate})
}

async function report (argv: Array<any>) {
  const swapFuncParams: SwapFuncParams = {useCache: false, interval: 'month', endDate: '2018-01'}
  let doSummary = false
  for (const arg of argv) {
    if (arg === 'day' || arg === 'month' || arg === 'hour' || arg === 'mins') {
      swapFuncParams.interval = arg
    } else if (arg === 'cache') {
      swapFuncParams.useCache = true
    } else if (arg === 'summary') {
      doSummary = true
      break
    } else if (arg === 'nocache') {
      swapFuncParams.useCache = false
    }

    if (process.argv.length === 5) {
      swapFuncParams.endDate = process.argv[4]
    }
  }

  if (!doSummary) {
    await main(swapFuncParams)
  } else {
    await doSummaryFunction(doChangelly)
    // await doSummaryFunction(doShapeShift)
  }
}

module.exports = { report }
