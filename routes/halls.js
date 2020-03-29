'use strict'

const express = require('express')
const router = express.Router()

function getSortedList (rooms) {
  const result = []
  rooms.forEach(value => result.push(value))
  result.sort((a, b) => a.name.localeCompare(b.name))
  return result
}

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('halls', { roomList: getSortedList(res.locals.rooms), title: 'Halls' })
})

router.post('/', function (req, res, next) {
  const userName = req.body.username
  if (userName) {
    res.cookie('userName', userName, {
      maxAge: 1000 * 86400 * 365,
      httpOnly: true,
      signed: true
    })
    res.locals.userName = userName
  }
  const newname = req.body.newname || `${userName}'s hall`
  const roomId = newname.makeSlug()
  let room = res.locals.rooms.get(roomId)
  if (!room) {
    room = {
      roomId,
      name: newname,
      users: new Map()
    }
    res.locals.rooms.set(roomId, room)
  }
  res.render('halls', { roomList: getSortedList(res.locals.rooms), title: 'Halls' })
})

module.exports = router
