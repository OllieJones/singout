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
      name.innerText = user.name + (user.self ? ' (me)' : '')
      const meter = document.createElement('meter')
      meter.max = 200
      meter.min = 0
      meter.value = 0
      meter.id = user.self ? 'meter-local-user' : `meter-${user.userId}`
      const metercol = document.createElement('td')
      metercol.appendChild(meter)
      const row = document.createElement('tr')
      row.appendChild(name)
      row.appendChild(metercol)
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

  function getStats (peerConnection, participant, freq = 500) {
    return setInterval(function () {
      const meter = document.getElementById(`meter-${participant.userId}`)
      const myMeter = document.getElementById('meter-local-user')
      if (meter || myMeter) {
        peerConnection.getStats(function (stats) {
          let theirLevel = 0
          let myLevel = 0
          if (meter) {
            /* search the stats for what we need */
            const inbound = stats.find(item => {
              return item.kind === 'audio' && item.type.indexOf('inbound') === 0 && item.trackId
            })
            if (!inbound) return
            const audioSource = stats.find(item => {
              return item.id === inbound.trackId && typeof item.audioLevel === 'number'
            })
            if (audioSource) {
              theirLevel = audioSource.audioLevel * 200
              meter.value = theirLevel
            }
          }
          if (myMeter) {
            const mySource = stats.find(item => {
              return item.kind === 'audio' && item.type === 'media-source' && typeof item.audioLevel === 'number'
            })
            if (mySource) {
              myLevel = mySource.audioLevel * 200
              myMeter.value = myLevel
            }
          }
          console.log(participant.userId, theirLevel.toFixed(0), myLevel.toFixed(0))
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
      statsInterval = getStats(pc, participant)
      if (!peerList.has(id)) peerList.set(id, participant)
      deferShowPeers(peerList)
    })
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
