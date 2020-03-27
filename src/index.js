import swarm from './swarm'

try {
  swarm(document.location.origin.replace(/^http/, 'ws'))
    .then(() => console.log('swarming'))
    .catch(error => console.error(error))
} catch (error) {
  console.log(error)
}
