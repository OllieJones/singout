'use strict'

import webrtcAdapter from 'webrtc-adapter'
import webrtcSwarm from './packages/webrtc-swarm'
import sdputils from './packages/sdputils'
import signalhub from 'signalhub'

if (!webrtcAdapter) console.error('no webrtc-adapter')

let deferred

function deferShowPeers (peerList) {
  if (deferred) return
  deferred = window.setTimeout(function (peerList) {
    showPeers(peerList)
    deferred = null
  }, 500, peerList)
}

function showPeers (peerList) {
  const list = []
  peerList.forEach(value => list.push(value))
  list.sort((a, b) => a.name.localeCompare(b.name))
  const peerTable = document.getElementById('peer-table-body')
  if (peerTable) {
    while (peerTable.hasChildNodes()) peerTable.removeChild(peerTable.firstChild)
    list.forEach(user => {
      const name = document.createElement('td')
      name.innerText = user.name
      const flag = document.createElement('td')
      flag.innerText = user.self ? '*' : ''
      const row = document.createElement('tr')
      row.appendChild(name)
      row.appendChild(flag)
      peerTable.appendChild(row)
    })
  }
}

// const unwantedCodecs = ['ISAC', 'G722', 'PCMU', 'PCMA', 'telephone-event', 'CN']
const unwantedCodecs = ['PCMU', 'PCMA', 'telephone-event', 'CN', 'ISAC']

function mungSdp (data, hub) {
  if (data.signal && data.signal.type === 'offer' && typeof data.signal.sdp === 'string') {
    let sdp = data.signal.sdp
    sdp = sdputils.maybeSetOpusOptions(sdp, { opusMaxPbr: 24000, opusStereo: 'false', opusDtx: 'true' })
    sdp = sdputils.maybeSetAudioSendBitRate(sdp, { audioSendBitrate: 32000 })
    sdp = sdputils.maybeSetAudioReceiveBitRate(sdp, { audioSendBitrate: 32000 })
    sdp = sdputils.maybePreferCodec(sdp, 'audio', 'send', 'opus')
    sdp = sdputils.maybeSetPacketTimes(sdp, 20, 40)
    unwantedCodecs.forEach(codec => {
      sdp = sdputils.removeCodecByName(sdp, codec, 'audio')
    })
    data.signal.sdp = sdp
    console.log(data.signal.sdp)
  }
  return data
}

export default async function swarm (hubUrl, options) {
  if (!webrtcSwarm.WEBRTC_SUPPORT) {
    window.alert('Sorry, this make and model of browser can\'t run this app. Please try another')
    return
  }
  const peerList = new Map()
  const audioTags = document.getElementById('audio-tags')
  let statsInterval

  const localStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true })

  window.remoteStreams = []
  const localParticipant = {
    userId: options.userId,
    name: options.userName || options.userId,
    self: true,
    label: '',
    type: 'userDescription'
  }
  peerList.set(options.userId, localParticipant)
  deferShowPeers(peerList)

  const hub = signalhub(options.roomId, [hubUrl])
  let sw = webrtcSwarm(hub, {
    uuid: options.userId,
    stream: localStream,
    config: {
      iceServers: [options.servers.v.iceServers]
    },
    wrap: mungSdp
  })

  hub.subscribe('all')
    .on('data', message => {
      if (message.type === 'userDescription') {
        const userId = message.userId
        if (userId !== options.userId && peerList.has(userId)) {
          const peer = peerList.get(userId)
          peer.name = message.name
          peer.label = message.label
          deferShowPeers(peerList)
        }
      }
    })

  let statsCounter = 0

  function getStats (peerConnection, freq = 5000) {
    return setInterval(function () {
      if (statsCounter++ < 10) {
        peerConnection.getStats(function (stats) {
          console.log(JSON.stringify(stats, 2))
        })
      }
    }, freq)
  }

  function ontrackHandler (event) {
    const audio = document.createElement('audio')
    audio.autoplay = true
    audio.muted = false
    audio.setAttribute('data-userid', '?')
    audioTags.appendChild(audio)
    audio.srcObject = event.streams[0]
  }

  sw.on('connect', function (pc, id) {
    /* a new peer is ready */
    pc.on('track', ontrackHandler)
    pc.on('connect', function () {
      console.log('connection completed')
      hub.broadcast('all', localParticipant)
      const participant = {
        userId: id,
        name: id,
        label: '',
        type: 'userDescription'
      }
      if (!peerList.has(id)) peerList.set(id, participant)
      deferShowPeers(peerList)
    })
    statsInterval = getStats(pc)
  })

  sw.on('disconnect', function (peer, id) {
    if (statsInterval) clearInterval(statsInterval)
    statsInterval = null
    if (peerList.has(id)) peerList.delete(id)
    deferShowPeers(peerList)
    console.log('disconnected from a peer:', id)
    console.log('total peers:', (sw && sw.peers && typeof sw.peers.length === 'number' ? sw.peers.length : 'none'))
    audioTags.childNodes.forEach(audio => {
      if (audio.getAttribute('data-userid') === 'id') {
        audioTags.removeChild(audio)
      }
    })
  })

  window.addEventListener('beforeunload', () => {
    if (deferred) window.clearTimeout(deferred)
    deferred = null
    sw.close()
    sw = null
  })
}
