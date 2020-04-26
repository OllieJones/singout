'use strict'
import swarm from './swarm'

function getMeta (name) {
  const el = document.getElementById(name)
  return el ? el.getAttribute('content') : null
}

window.addEventListener('load', (event) => {
  const roomId = getMeta('singout-room')
  const userId = getMeta('singout-userid')
  const userName = getMeta('singout-username')
  const servers = JSON.parse(getMeta('singout-servers'))
  const hub = getMeta('singout-hub')
  const video = getMeta('singout-video')

  try {
    const hubHost = document.location.protocol + '//' + document.location.hostname + hub
    swarm(hubHost, { roomId, userId, userName, servers, video })
      .then(() => console.log('swarming'))
      .catch(error => console.error(error))
  } catch (error) {
    console.log(error)
  }
})
