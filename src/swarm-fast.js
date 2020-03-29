'use strict'
/* global WebSocket */

import FastRTCSwarm from '@mattkrick/fast-rtc-swarm'

console.log('loading fast-rtc-swarm')

export default async function swarmFast (websockurl = 'ws://localhost:3000', options) {
  const cam = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })
  const socket = new WebSocket(websockurl)
  socket.addEventListener('open', () => {
    const swarm = new FastRTCSwarm({
      isOfferer: true,
      streams: cam,
      roomId: options.roomId,
      userId: options.userId,
      iceServers: options.servers.iceServers
    })
    // send the signal to the signaling server
    swarm.on('signal', (signal) => {
      socket.send(JSON.stringify(signal))
    })
    // when the signal come back, dispatch it to the swarm
    socket.addEventListener('message', (event) => {
      const payload = JSON.parse(event.data)
      swarm.dispatch(payload)
    })
    // when the connection is open, say hi to your new peer
    swarm.on('dataOpen', (peer) => {
      console.log('data channel open!')
      peer.send('hi')
    })
    // when your peer says hi, log it
    swarm.on('data', (data, peer) => {
      console.log('data received', data, peer)
    })
  })
}
