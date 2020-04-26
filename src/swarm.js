'use strict'

import webrtcSwarm from '@olliejones/webrtc-swarm'
import sdputils from './packages/sdputils'
import signalhub from 'signalhub'

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

      const nameCol = document.createElement('td')
      nameCol.innerText = user.name + (user.self ? ' (me)' : '')

      const statCol = document.createElement('td')
      statCol.id = user.self ? 'stat-local-user' : `stat-${user.userId}`

      const latencyCol = document.createElement('td')
      if (!user.self) {
        const latency = document.createElement('meter')
        latency.max = 200
        latency.min = 0
        latency.value = 0
        latency.id = `latency-${user.userId}`
        latencyCol.appendChild(latency)
      }

      const meter = document.createElement('meter')
      meter.max = 200
      meter.min = 0
      meter.value = 0
      meter.id = user.self ? 'meter-local-user' : `meter-${user.userId}`
      const meterCol = document.createElement('td')
      meterCol.appendChild(meter)

      const row = document.createElement('tr')
      row.appendChild(nameCol)
      row.appendChild(statCol)
      row.appendChild(latencyCol)
      row.appendChild(meterCol)
      peerTable.appendChild(row)
    })
  }
}

function makeConstraints (options) {
  const c = {}
  let video = false
  if (options.video.toLowerCase() === 'true') video = true
  else if (options.video.toLowerCase() === 'false') video = false
  else video = options.video

  c.video = video

  const a = {}
  a.sampleSize = 16
  a.sampleRate = { min: 16000, ideal: 24000, max: 48000 }
  a.latency = { ideal: 0.005, max: 0.02 }
  a.noiseSuppression = false
  a.channelCount = { ideal: 1 }
  a.echoCancellation = false
  a.autoGainControl = true

  c.audio = a
  return c
}

function displayCapabilities (stream) {
  console.log(navigator.mediaDevices.getSupportedConstraints())
  const tracks = stream.getTracks()
  tracks.forEach(track => {
    const caps = track.getCapabilities()
    const settings = track.getSettings()
    const constraints = track.getConstraints()
    console.log(track.kind, track.label, caps, settings, constraints)
  })
}

// const unwantedCodecs = ['ISAC', 'G722', 'PCMU', 'PCMA', 'telephone-event', 'CN']
const unwantedCodecs = ['PCMU', 'PCMA', 'telephone-event', 'ISAC']

function mungSdp (data, hub) {
  if (data.signal && data.signal.type === 'offer' && typeof data.signal.sdp === 'string') {
    let sdp = data.signal.sdp
    sdp = sdputils.maybeSetOpusOptions(sdp, { opusMaxPbr: 24000, opusStereo: 'false', opusDtx: 'true' })
    sdp = sdputils.maybeSetAudioSendBitRate(sdp, { audioSendBitrate: 16000 })
    sdp = sdputils.maybeSetAudioReceiveBitRate(sdp, { audioRecvBitrate: 16000 })
    sdp = sdputils.maybePreferCodec(sdp, 'audio', 'send', 'opus')
    sdp = sdputils.maybeSetPacketTimes(sdp, 5, 20)
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
  const playerTags = document.getElementById('audio-tags')
  let statsInterval

  const localStream = await navigator.mediaDevices.getUserMedia(makeConstraints(options))

  const localParticipant = {
    userId: options.userId,
    name: options.userName || options.userId,
    self: true,
    label: '',
    type: 'userDescription'
  }

  displayCapabilities(localStream)

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
      const stat = document.getElementById(`stat-${participant.userId}`)
      const myStat = document.getElementById('stat-local-user')
      const latency = document.getElementById(`latency-${participant.userId}`)
      if (meter || myMeter || stat || myStat || latency) {
        peerConnection.getStats((_, stats) => {
          if (!stats) {
            return
          }
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
          let rttReport = ''
          if (stat || latency) {
            const cpair = stats.find(item => {
              return item.type === 'candidate-pair' && item.nominated === true &&
                typeof item.totalRoundTripTime === 'number' &&
                typeof item.currentRoundTripTime === 'number'
            })
            const latencyNow = Math.round(cpair.currentRoundTripTime * 1000)
            rttReport = `latency:${latencyNow}`
            if (stat) stat.innerText = rttReport
            if (latency) latency.value = latencyNow
          }
          console.log(participant.userId, theirLevel.toFixed(0), myLevel.toFixed(0), rttReport)
        })
      }
    }, freq)
  }

  function ontrackHandler (track, stream) {
    const player = document.createElement('audio')
    player.autoplay = true
    player.muted = false
    player.setAttribute('data-userid', '?')
    playerTags.appendChild(player)
    player.srcObject = stream
  }

  sw.on('peer-connecting', function (pc, id) {
    /* a new peer is ready for the connection process */
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
    playerTags.childNodes.forEach(audio => {
      if (audio.getAttribute('data-userid') === 'id') {
        playerTags.removeChild(audio)
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
