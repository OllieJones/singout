#!/usr/bin/env node
'use strict'

/**
 * Module dependencies.
 */
global.debug = require('debug')('singout:server')
const config = require('config')
require('properties')

global.singout = config.get('singout')

const app = require('./express_server')
const http = require('http')

/**
 * Get port from environment and store in Express.
 */

var port = normalizePort(process.env.PORT || '3000')
app.set('port', port)
global.rooms = new Map()
/**
 * Create HTTP server.
 */

var server = http.createServer(app)

/**
 * Listen on provided port, on all network interfaces.
 */

server.listen(port)
server.on('error', onError)
server.on('listening', onListening)

const hub = require('./hub_server')(port + 1)
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
