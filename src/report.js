const { report } = require('./reporter.js')

async function main () {
  await report(process.argv)
  process.exit()
}

main()
