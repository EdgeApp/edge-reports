// @flow

const fetch = require('node-fetch')
const js = require('jsonfile')
const { bns } = require('biggystring')
// const sleep = require('await-sleep')
// const fs = require('fs')

const confFileName = '../config.json'
const config = js.readFileSync(confFileName)

// const maxErrors = 10

// async function getUTXOS (keyObject) {
//   console.log('**********************************************************************')
//   console.log('*********** Getting utxos for address: ' + keyObject.addressToSweep)
//   let request = `${config.url}/addrs/${keyObject.addressToSweep}?unspentOnly=true&confirmation=1&limit=2000&token=${config.token}`
//   console.log(request)
//   let response
//   let numErrors = 0
//   while (1) {
//     try {
//       response = await fetch(request)
//       break
//     } catch (e) {
//       numErrors++
//       if (numErrors > maxErrors) {
//         console.log('Hit max errors')
//         return
//       }
//       console.log('Hit fetch error. Sleeping for ' + (throttleTime * numErrors).toString())
//       await sleep(throttleTime * numErrors)
//     }
//   }
//   let jsonObj = await response.json()
//   let txs = jsonObj.txrefs
//   let rawUTXO = []
//   let numUtxoBlock = 0
//   let i = 0
//   numErrors = 0
//   console.log('txs.length=' + txs.length.toString())
//   while (i < txs.length) {
//     let request = `${config.url}/txs/${txs[i].tx_hash}?includeHex=true&token=${config.token}`
//     console.log(request)
//     try {
//       let response = await fetch(request)
//       let jsonObj = await response.json()
//
//       if (jsonObj && jsonObj.hex) {
//         rawUTXO.push({
//           rawTx: jsonObj.hex,
//           index: txs[i].tx_output_n,
//           height: txs[i].block_height
//         })
//
//         if (rawUTXO.length >= config.limit) {
//           const rawUtxoLimitBlock = rawUTXO.slice(0)
//           const tx = await createTX(rawUtxoLimitBlock, keyObject)
//           const txHex = tx.toRaw().toString('hex')
//           console.log('***** Hit limit. Creating tx *****')
//           console.log('sub tx: ', txHex)
//           fs.writeFileSync(`out/${keyObject.addressToSweep}_tx_${numUtxoBlock}.txt`, txHex + '\n')
//           numUtxoBlock++
//           rawUTXO = []
//         }
//       }
//       numErrors = 0
//       i++
//       await sleep(throttleTime)
//     } catch (e) {
//       console.log(e)
//       numErrors++
//       if (numErrors > maxErrors) {
//         console.log('Hit max errors')
//         return
//       }
//       console.log('Hit error. Sleeping for ' + (throttleTime * numErrors).toString())
//       await sleep(throttleTime * numErrors)
//     }
//   }
//   if (rawUTXO.length) {
//     console.log('***** Creating final tx *****')
//     const rawUtxoLimitBlock = rawUTXO.slice(0)
//     const tx = await createTX(rawUtxoLimitBlock, keyObject)
//     const txHex = tx.toRaw().toString('hex')
//     console.log('final tx: ', txHex)
//     fs.writeFileSync(`out/${keyObject.addressToSweep}_tx_${numUtxoBlock}.txt`, txHex + '\n')
//   }
//   await sleep(throttleTime)
// // return rawUTXO
// }
//
// async function createTX (utxos, keyObject) {
//   const mtx = new bcoin.primitives.MTX()
//   let amount = 0
//   const coins = utxos.map(({ rawTx, index, height }) => {
//     const bufferTX = Buffer.from(rawTx, 'hex')
//     const bcoinTX = bcoin.primitives.TX.fromRaw(bufferTX)
//     const coin = bcoin.primitives.Coin.fromTX(bcoinTX, index, height)
//     amount += coin.value
//     return coin
//   })
//
//   const script = bcoin.script.fromAddress(config.destination)
//   mtx.addOutput(script, amount)
//
//   await mtx.fund(coins, {
//     selection: 'value',
//     subtractFee: true,
//     rate: config.rate,
//     changeAddress: keyObject.addressToSweep
//   })
//   let privateKey = cs.decode(keyObject.seed)
//   privateKey = privateKey.slice(1, privateKey.length - 1)
//   const key = bcoin.primitives.KeyRing.fromPrivate(privateKey, true)
//   mtx.sign([key])
//
//   return mtx
// }
//
// async function main () {
//   if (process.argv[2] === 'pushtx') {
//     const dir = fs.readdirSync('out/')
//     for (const f of dir) {
//       try {
//         console.log('reading file: ' + f)
//         const file = fs.readFileSync('out/' + f, 'utf8')
//         console.log('pushtx file: ' + f)
//         await fetch('https://blockchain.info/pushtx', {
//           method: 'POST',
//           body:    'tx=' + file,
//           headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         })
//       } catch (e) {
//         console.log(e)
//       }
//     }
//     return
//   }
//
//   try {
//     fs.mkdirSync('out')
//   } catch (e) {
//     console.log(e)
//   }
//   for (const keyObject of config.keysToSweep) {
//     const rawUtxo = await getUTXOS(keyObject)
//     // console.log('rawUtxo:', rawUtxo)
//     // const tx = await createTX(rawUtxo, keyObject)
//     // const txHex = tx.toRaw().toString('hex')
//     // console.log('main tx: ', txHex)
//     // fs.writeFileSync(`out/${keyObject.addressToSweep}_tx.txt`, txHex + '\n')
//   }
// }

//
// getUTXOS()
// .then(rawUTXO => {
//   console.log('rawUTXO', rawUTXO)
//   return createTX(rawUTXO)
// })
// .then(tx => {
//   console.log('tx', tx.toRaw().toString('hex'))
// })
//
//
//

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

function pad(num, size) {
  let s = num + '';
  while (s.length < size) {
    s = '0' + s
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
async function main () {
  const apiKey = config.shapeShiftApiKey
  const request = `https://shapeshift.io/txbyapikey/${apiKey}`
  console.log(request)
  let response
  try {
    response = await fetch(request)
  } catch (e) {
    console.log(e)
    return
  }
  let jsonObj = await response.json()

  console.log('Number of transactions:' + jsonObj.length.toString())

  const txCountMap: {[date: string]: number} = {}
  const amountMap:  {[date: string]: string} = {}
  const revMap: {[date: string]: string} = {}
  let amountTotal = '0'
  let revTotal = '0'
  const dateNow = Date.now()
  for (const tx: ShapeShiftTx of jsonObj) {
    if (daydiff(tx.timestamp * 1000, dateNow) > 7) {
      break
    }
    const date: Date = new Date(tx.timestamp * 1000)
    const year = date.getFullYear()
    const month = pad(date.getMonth() + 1, 2)
    const day = pad(date.getDate() + 1, 2)

    const idx = `${year}-${month}-${day}`

    if (txCountMap[idx] === undefined) {
      txCountMap[idx] = 0
      amountMap[idx] = '0'
      revMap[idx] = '0'
    }
    txCountMap[idx]++

    let amountBtc: string = '0'
    if (tx.inputCurrency === 'BTC') {
      amountBtc = tx.inputAmount.toString()
    } else {
      const rate = await getRate(`${tx.inputCurrency}_btc`)
      amountBtc = bns.mul(rate, tx.inputAmount.toString())
    }
    amountMap[idx] = bns.add(amountMap[idx], amountBtc)
    const rev = bns.mul(amountBtc, '0.0025')
    revMap[idx] = bns.add(revMap[idx], rev)

    amountTotal = bns.add(amountTotal, amountBtc)
    revTotal = bns.add(revTotal, rev)
  }

  console.log('txCountMap:', txCountMap)
  console.log('amountMap:', amountMap)
  console.log('revMap:', revMap)
  console.log('amountTotal: ' + amountTotal)
  console.log('revTotal: ' + revTotal)
}

main()
