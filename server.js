#!/usr/bin/env node
'use strict'

/**
 * Module dependencies.
 */
const app = require('./express_server')
global.debug = require('debug')('singout:server')
const http = require('http')
const WebSocket = require('ws')

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000')
app.set('port', port)

/**
 * Create HTTP server.
 */

var server = http.createServer(app)

const wss = new WebSocket.Server({ server })
global.wss = wss
const rooms = new Map()
global.rooms = rooms

function fanout (init, message) {
  wss.clients.forEach(ws => {
    if (ws.init && ws.init.roomId && ws.init.roomId === init.roomId) {
      ws.send(JSON.stringify(message))
    }
  })
}

wss.on('connection', function connection (ws) {
  global.debug('incoming websocket connection')
  ws.on('message', function incoming (messageString) {
    const message = JSON.parse(messageString)
    console.log('incoming', messageString)
    console.log('message type', message.type)
    switch (message.type) {
      case 'init': {
        ws.init = message
        const { roomId, userId } = message
        let room = rooms.get(roomId)
        if (!room) {
          room = {
            roomId,
            users: new Map()
          }
          rooms.set(roomId, room)
        }
        let user = room.users.get(userId)
        if (!user) {
          user = {
            roomId,
            userId
          }
          room.user.set(userId, user)
        }
        user.ws = ws
      }
        break
      case 'candidate':
        fanout(ws.init, message)
        break
      default:
        /* sdps don't have a type */
        if (message.sdp) fanout(ws.init, message)
        break
    }
  })
})

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort (val) {
  var port = parseInt(val, 10)

  if (isNaN(port)) {
    // named pipe
    return val
  }

  if (port >= 0) {
    // port number
    return port
  }

  return false
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError (error) {
  if (error.syscall !== 'listen') {
    throw error
  }

  var bind = typeof port === 'string'
    ? 'Pipe ' + port
    : 'Port ' + port

  // handle specific listen errors with friendly messages
  switch (error.code) {
    case 'EACCES':
      console.error(bind + ' requires elevated privileges')
      process.exit(1)
      // eslint-disable-next-line no-unreachable
      break
    case 'EADDRINUSE':
      console.error(bind + ' is already in use')
      process.exit(1)
      // eslint-disable-next-line no-unreachable
      break
    default:
      throw error
  }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening () {
  var addr = server.address()
  var bind = typeof addr === 'string'
    ? 'pipe ' + addr
    : 'port ' + addr.port
  global.debug('Listening on ' + bind)
}
