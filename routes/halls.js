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
  res.locals.rooms.forEach((room, name) => {
    // console.log(room.roomId, room.name, room.video, room.users.size)
  })
  res.render('halls', { roomList: getSortedList(res.locals.rooms), title: 'Lobby' })
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
  if (req.body.new === 'new') {
    const newname = req.body.newname || `${userName}'s hall`
    const video = !!req.body.newvideo
    const roomId = newname.makeSlug()
    let room = res.locals.rooms.get(roomId)
    if (!room) {
      room = {
        roomId,
        name: newname,
        video: video,
        users: new Map()
      }
      res.locals.rooms.set(roomId, room)
    }
  }
  res.render('halls', { roomList: getSortedList(res.locals.rooms), title: 'Halls' })
})

module.exports = router
