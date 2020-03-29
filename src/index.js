'use strict'
import swarm from './swarm'

function getMeta (name) {
  const el = document.getElementById(name)
  return el.getAttribute('content')
}

window.addEventListener('load', (event) => {
  const roomId = getMeta('singout-room')
  const userId = getMeta('singout-user')
  const servers = JSON.parse(getMeta('singout-servers'))
  const hub = getMeta('singout-hub')

  try {
    const hubHost = document.location.protocol + '//' + document.location.hostname + hub
    swarm(hubHost, { roomId, userId, servers })
      .then(() => console.log('swarming'))
      .catch(error => console.error(error))
  } catch (error) {
    console.log(error)
  }
})
