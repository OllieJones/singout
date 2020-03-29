'use strict'

const express = require('express')
const createError = require('http-errors')
const stunturn = require('../lib/stunturn')
const router = express.Router()

router.param('roomId', function (req, res, next, roomId) {
  const room = res.locals.rooms.get(roomId)
  if (!room) return next(createError(404, roomId + ' not found'))
  res.locals.room = room
  res.locals.roomId = roomId
  next()
})

router.get('/', function (req, res, next) {
  res.redirect('halls')
})

router.get('/:roomId', async function (req, res, next) {
  const title = `${res.locals.userName} in ${res.locals.room.name}`
  try {
    res.locals.stunturnServers = await stunturn()
    res.locals.hubSlug = global.singout.hubSlug
    res.render('hall', { title })
  } catch (error) {
    next(error)
  }
})

module.exports = router
