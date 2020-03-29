'use strict'

import webrtcSwarm from 'webrtc-swarm'
import signalhub from 'signalhub'

console.log('loading webrtc-swarm')

export default async function swarm (hubUrl, options) {
  const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
  const hub = signalhub(options.roomId, [hubUrl])
  const sw = webrtcSwarm(hub, {
    stream,
    uuid: options.userId
  })

  sw.on('peer', function (peer, id) {
    console.log('connected to a new peer:', id)
    console.log('total peers:', sw.peers.length)
  })

  sw.on('disconnect', function (peer, id) {
    console.log('disconnected from a peer:', id)
    console.log('total peers:', sw.peers.length)
  })
}
