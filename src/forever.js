// @flow
const { report } = require('./reporter.js')
const fs = require('fs')

const config = require('../config.json')
const clog = console.log
let consoleString
// console.log = str => {
//   clog(str)
//   consoleString = consoleString + str + '\n'
// }

const snooze = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

async function main () {
  while (1) {
    clog('Starting...')
    consoleString = ''
    const s = 'summary'
    const summary = [s]
    await report(summary)
    fs.writeFileSync(config.outputPath, consoleString)
    await snooze(config.outputDelay)
  }
}

main()
