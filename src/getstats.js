/**
 * stats reporting function
 * @param peerConnection
 * @param participant
 * @param freq
 * @returns {number}
 */
export default function getStats (peerConnection, participant, freq = 500) {
  return setTimeout(function () {
    if (!peerConnection) {
      /* connection has gone away */
      console.log('peerConnection gone')
      return
    }
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
          if (latency) {
            latency.value = latencyNow
            latency.title = latencyNow + ' milliseconds round-trip delay'
          }
        }
      })
    }
  }, freq)
}
