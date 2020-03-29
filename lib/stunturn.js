'use strict'
// From https://global.xirsys.net/dashboard/services

const https = require('https')
const o = {
  format: 'urls'
}
const bodyString = JSON.stringify(o)
const options = {
  host: 'global.xirsys.net',
  path: '/_turn/SingOutLive',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': bodyString.length
  }
}
const xirsysCredential = global.singout.xirsysCredential

// curl -s -H "Content-type: application/json" -XPUT "https://OllieJones:REDACTED@global.xirsys.net/_turn/SingOutLive" -d '{"format": "urls"}'

function stunturn () {
  // Node Get ICE STUN and TURN list
  options.headers.Authorization = `Basic ${Buffer.from(xirsysCredential).toString('base64')}`
  return new Promise(function (resolve, reject) {
    const httpreq = https.request(options, function (httpres) {
      const strs = []
      httpres.on('data', function (data) { strs.push(data) })
      httpres.on('error', function (e) { reject(e) })
      httpres.on('end', function () { resolve(strs.join('')) })
    })
    httpreq.on('error', function (e) { reject(e) })
    httpreq.write(bodyString)
    httpreq.end()
  })
}

module.exports = stunturn
