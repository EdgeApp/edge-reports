const { report } = require('./reporter.js')

async function main () {
  await report(process.argv) // third argument in process.argv array is often 'summary'
  process.exit()
}

main()
