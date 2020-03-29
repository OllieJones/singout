'use strict'

module.exports = function makeHubServer (port) {
  const signalhubServer = require('signalhub/server')
  const hub = signalhubServer({ maxBroadcasts: 0 })

  hub.on('subscribe', function (channel) {
    console.log('subscribe: %s', channel)
  })

  hub.on('publish', function (channel, message) {
    console.log('broadcast: %s (%d)', channel, message.length)
  })

  hub.listen(port, null, function () {
    const addr = hub.address()
    global.debug('signalhub listening on port %d', addr.port)
  })
  return hub
}
