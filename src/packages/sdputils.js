'use strict'
/*
 *  Copyright (c) 2014 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */

/* More information about these options at jshint.com/docs/options */

// eslint-disable-next-line no-unused-vars
/* globals  adapter, trace */

function trace () {}

module.exports = {
  maybeSetPacketTimes,
  setCodecParam,
  iceCandidateType,
  maybeSetOpusOptions,
  maybePreferAudioReceiveCodec,
  maybePreferAudioSendCodec,
  maybePreferCodec,
  maybeSetAudioReceiveBitRate,
  maybeSetAudioSendBitRate,
  maybePreferVideoReceiveCodec,
  maybePreferVideoSendCodec,
  maybeSetVideoReceiveBitRate,
  maybeSetVideoSendBitRate,
  maybeSetVideoSendInitialBitRate,
  maybeRemoveVideoFec,
  mergeConstraints,
  removeCodecParam,
  removeCodecByName
}

function mergeConstraints (cons1, cons2) {
  if (!cons1 || !cons2) {
    return cons1 || cons2
  }
  const merged = cons1
  for (const key in cons2) {
    if (Object.prototype.hasOwnProperty.call(cons2, key)) {
      merged[key] = cons2[key]
    }
  }
  return merged
}

function iceCandidateType (candidateStr) {
  return candidateStr.split(' ')[7]
}

function maybeSetPacketTimes (sdp, defsize, maxsize, type = 'audio' ) {
  const sdpLines = sdp.split('\r\n')
  const mLineIndex = findLine(sdpLines, 'a=', 'ssrc')
  if (mLineIndex) {
    if (defsize) sdpLines.splice(mLineIndex, 0, `a=ptime:${defsize}`)
    if (maxsize) sdpLines.splice(mLineIndex + 1, 0, `a=ptime:${maxsize}`)
    return sdpLines.join('\r\n')
  }
  return sdp
}

/**
 * Set opus options (if possible)
 * @param {string} sdp Session Description Protocol block
 * @param {object} params
 * @param {boolean} params.opusStereo use stereo
 * @param {boolean} params.opusFec use forward error correction
 * @param {boolean} params.opusDtx use discontinuous transmission mode, for less network traffic during silence
 * @param {number} params.opusMaxPbr maximum playback ratee in samples/sec
 * @returns {string} updated sdp
 */
function maybeSetOpusOptions (sdp, params) {
  // Set Opus in Stereo, if stereo is true, unset it, if stereo is false, and
  // do nothing if otherwise.
  if (params.opusStereo === 'true') {
    sdp = setCodecParam(sdp, 'opus/48000', 'stereo', '1')
  } else if (params.opusStereo === 'false') {
    sdp = removeCodecParam(sdp, 'opus/48000', 'stereo')
  }

  // Set Opus Forward Error Correction, if opusfec is true, unset it, if opusfec is false, and
  // do nothing if otherwise.
  if (params.opusFec === 'true') {
    sdp = setCodecParam(sdp, 'opus/48000', 'useinbandfec', '1')
  } else if (params.opusFec === 'false') {
    sdp = removeCodecParam(sdp, 'opus/48000', 'useinbandfec')
  }

  // Set Opus Discontinuous Transmission (less traffic during silence),
  // if opusdtx is true, unset it, if opusdtx is false, and
  // do nothing if otherwise.
  if (params.opusDtx === 'true') {
    sdp = setCodecParam(sdp, 'opus/48000', 'usedtx', '1')
  } else if (params.opusDtx === 'false') {
    sdp = removeCodecParam(sdp, 'opus/48000', 'usedtx')
  }

  // Set Opus maxplaybackrate, if requested.
  if (params.opusMaxPbr) {
    sdp = setCodecParam(
      sdp, 'opus/48000', 'maxplaybackrate', params.opusMaxPbr)
  }
  return sdp
}

/**
 * Set opus audio send bitrate (if possible)
 * @param {string} sdp Session Description Protocol block
 * @param {object} params
 * @param {number} params.audioSendBitrate bits per second to send
 * @returns {string} updated sdp
 */
function maybeSetAudioSendBitRate (sdp, params) {
  if (!params.audioSendBitrate) {
    return sdp
  }
  trace('Prefer audio send bitrate: ' + params.audioSendBitrate)
  return preferBitRate(sdp, params.audioSendBitrate, 'audio')
}

/**
 * Set opus audio receive bitrate (if possible)
 * @param {string} sdp Session Description Protocol block
 * @param {{audioSendBitrate: number}} params
 * @param {number} params.audioRecvBitrate bits per second to receive
 * @returns {string} updated sdp
 */
function maybeSetAudioReceiveBitRate (sdp, params) {
  if (!params.audioRecvBitrate) {
    return sdp
  }
  trace('Prefer audio receive bitrate: ' + params.audioRecvBitrate)
  return preferBitRate(sdp, params.audioRecvBitrate, 'audio')
}

/**
 * Set video send bitrate (if possible)
 * @param {string} sdp Session Description Protocol block
 * @param {object} params
 * @param {number} params.videoSendBitrate bits per second to send
 * @returns {string} updated sdp
 */
function maybeSetVideoSendBitRate (sdp, params) {
  if (!params.videoSendBitrate) {
    return sdp
  }
  trace('Prefer video send bitrate: ' + params.videoSendBitrate)
  return preferBitRate(sdp, params.videoSendBitrate, 'video')
}

function maybeSetVideoReceiveBitRate (sdp, params) {
  if (!params.videoRecvBitrate) {
    return sdp
  }
  trace('Prefer video receive bitrate: ' + params.videoRecvBitrate)
  return preferBitRate(sdp, params.videoRecvBitrate, 'video')
}

// Add a b=AS:bitrate line to the m=mediaType section.
function preferBitRate (sdp, bitrate, mediaType) {
  const sdpLines = sdp.split('\r\n')

  // Find m line for the given mediaType.
  const mLineIndex = findLine(sdpLines, 'm=', mediaType)
  if (mLineIndex === null) {
    trace('Failed to add bandwidth line to sdp, as no m-line found')
    return sdp
  }

  // Find next m-line if any.
  let nextMLineIndex = findLineInRange(sdpLines, mLineIndex + 1, -1, 'm=')
  if (nextMLineIndex === null) {
    nextMLineIndex = sdpLines.length
  }

  // Find c-line corresponding to the m-line.
  const cLineIndex = findLineInRange(sdpLines, mLineIndex + 1,
    nextMLineIndex, 'c=')
  if (cLineIndex === null) {
    trace('Failed to add bandwidth line to sdp, as no c-line found')
    return sdp
  }

  // Check if bandwidth line already exists between c-line and next m-line.
  const bLineIndex = findLineInRange(sdpLines, cLineIndex + 1,
    nextMLineIndex, 'b=AS')
  if (bLineIndex) {
    sdpLines.splice(bLineIndex, 1)
  }

  // Create the b (bandwidth) sdp line.
  const bwLine = 'b=AS:' + bitrate
  // As per RFC 4566, the b line should follow after c-line.
  sdpLines.splice(cLineIndex + 1, 0, bwLine)
  sdp = sdpLines.join('\r\n')
  return sdp
}

// Add an a=fmtp: x-google-min-bitrate=kbps line, if videoSendInitialBitrate
// is specified. We'll also add a x-google-min-bitrate value, since the max
// must be >= the min.
function maybeSetVideoSendInitialBitRate (sdp, params) {
  let initialBitrate = parseInt(params.videoSendInitialBitrate)
  if (!initialBitrate) {
    return sdp
  }

  // Validate the initial bitrate value.
  let maxBitrate = parseInt(initialBitrate)
  const bitrate = parseInt(params.videoSendBitrate)
  if (bitrate) {
    if (initialBitrate > bitrate) {
      trace('Clamping initial bitrate to max bitrate of ' + bitrate + ' kbps.')
      initialBitrate = bitrate
      params.videoSendInitialBitrate = initialBitrate
    }
    maxBitrate = bitrate
  }

  const sdpLines = sdp.split('\r\n')

  // Search for m line.
  const mLineIndex = findLine(sdpLines, 'm=', 'video')
  if (mLineIndex === null) {
    trace('Failed to find video m-line')
    return sdp
  }
  // Figure out the first codec payload type on the m=video SDP line.
  const videoMLine = sdpLines[mLineIndex]
  const pattern = new RegExp('m=video\\s\\d+\\s[A-Z/]+\\s')
  const sendPayloadType = videoMLine.split(pattern)[1].split(' ')[0]
  const fmtpLine = sdpLines[findLine(sdpLines, 'a=rtpmap', sendPayloadType)]
  const codecName = fmtpLine.split('a=rtpmap:' +
    sendPayloadType)[1].split('/')[0]

  // Use codec from params if specified via URL param, otherwise use from SDP.
  const codec = params.videoSendCodec || codecName
  sdp = setCodecParam(sdp, codec, 'x-google-min-bitrate',
    params.videoSendInitialBitrate.toString())
  sdp = setCodecParam(sdp, codec, 'x-google-max-bitrate',
    maxBitrate.toString())

  return sdp
}

function removePayloadTypeFromMline (mLine, payloadType) {
  mLine = mLine.split(' ')
  for (let i = 0; i < mLine.length; ++i) {
    if (mLine[i] === payloadType.toString()) {
      mLine.splice(i, 1)
    }
  }
  return mLine.join(' ')
}

function removeCodecByName (sdp, codec, type) {
  let sdpLines = sdp.split('\r\n')
  let count = sdpLines.length
  while (true) {
    sdpLines = _removeCodecByName(sdpLines, codec, type)
    const newCount = sdpLines.length
    if (count === newCount) break
    count = newCount
  }
  sdp = sdpLines.join('\r\n')
  return sdp
}

/**
 * Remove a codec from an SDP
 * @param {Array.string} sdpLines
 * @param {string} codec to suppress
 * @returns {Array.string} sdpLines
 */
function _removeCodecByName (sdpLines, codec, type = 'video') {
  const index = findLine(sdpLines, 'a=rtpmap', codec)
  if (index === null) {
    return sdpLines
  }
  const payloadType = getCodecPayloadTypeFromLine(sdpLines[index])
  sdpLines.splice(index, 1)

  // Search for the video m= line and remove the codec.
  const mLineIndex = findLine(sdpLines, 'm=', type)
  if (mLineIndex === null) {
    return sdpLines
  }
  sdpLines[mLineIndex] = removePayloadTypeFromMline(sdpLines[mLineIndex],
    payloadType)
  return sdpLines
}

function removeCodecByPayloadType (sdpLines, payloadType) {
  const index = findLine(sdpLines, 'a=rtpmap', payloadType.toString())
  if (index === null) {
    return sdpLines
  }
  sdpLines.splice(index, 1)

  // Search for the video m= line and remove the codec.
  const mLineIndex = findLine(sdpLines, 'm=', 'video')
  if (mLineIndex === null) {
    return sdpLines
  }
  sdpLines[mLineIndex] = removePayloadTypeFromMline(sdpLines[mLineIndex],
    payloadType)
  return sdpLines
}

function maybeRemoveVideoFec (sdp, params) {
  if (params.videoFec !== 'false') {
    return sdp
  }

  let sdpLines = sdp.split('\r\n')

  let index = findLine(sdpLines, 'a=rtpmap', 'red')
  if (index === null) {
    return sdp
  }
  const redPayloadType = getCodecPayloadTypeFromLine(sdpLines[index])
  sdpLines = removeCodecByPayloadType(sdpLines, redPayloadType)

  sdpLines = _removeCodecByName(sdpLines, 'ulpfec')

  // Remove fmtp lines associated with red codec.
  index = findLine(sdpLines, 'a=fmtp', redPayloadType.toString())
  if (index === null) {
    return sdp
  }
  const fmtpLine = parseFmtpLine(sdpLines[index])
  const rtxPayloadType = fmtpLine.pt
  if (rtxPayloadType === null) {
    return sdp
  }
  sdpLines.splice(index, 1)

  sdpLines = removeCodecByPayloadType(sdpLines, rtxPayloadType)
  return sdpLines.join('\r\n')
}

// Promotes |audioSendCodec| to be the first in the m=audio line, if set.
function maybePreferAudioSendCodec (sdp, params) {
  return maybePreferCodec(sdp, 'audio', 'send', params.audioSendCodec)
}

// Promotes |audioRecvCodec| to be the first in the m=audio line, if set.
function maybePreferAudioReceiveCodec (sdp, params) {
  return maybePreferCodec(sdp, 'audio', 'receive', params.audioRecvCodec)
}

// Promotes |videoSendCodec| to be the first in the m=audio line, if set.
function maybePreferVideoSendCodec (sdp, params) {
  return maybePreferCodec(sdp, 'video', 'send', params.videoSendCodec)
}

// Promotes |videoRecvCodec| to be the first in the m=audio line, if set.
function maybePreferVideoReceiveCodec (sdp, params) {
  return maybePreferCodec(sdp, 'video', 'receive', params.videoRecvCodec)
}

/**
 * Sets |codec| as the default |type| codec if it's present.
 * @param {string} sdp
 * @param {string} type 'audio' or 'video'
 * @param {string}  direction 'send' or 'receive'
 * @param {string}  codec e.g. 'opus/48000'
 * @returns {string} sdp
 */
function maybePreferCodec (sdp, type, direction, codec) {
  const str = type + ' ' + direction + ' codec'
  if (!codec) {
    trace('No preference on ' + str + '.')
    return sdp
  }

  trace('Prefer ' + str + ': ' + codec)

  const sdpLines = sdp.split('\r\n')

  // Search for m line.
  const mLineIndex = findLine(sdpLines, 'm=', type)
  if (mLineIndex === null) {
    return sdp
  }

  // If the codec is available, set it as the default in m line.
  let payload = null
  // Iterate through rtpmap enumerations to find all matching codec entries
  for (let i = sdpLines.length - 1; i >= 0; --i) {
    // Finds first match in rtpmap
    const index = findLineInRange(sdpLines, i, 0, 'a=rtpmap', codec, 'desc')
    if (index !== null) {
      // Skip all of the entries between i and index match
      i = index
      payload = getCodecPayloadTypeFromLine(sdpLines[index])
      if (payload) {
        // Move codec to top
        sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], payload)
      }
    } else {
      // No match means we can break the loop
      break
    }
  }

  sdp = sdpLines.join('\r\n')
  return sdp
}

// Set fmtp param to specific codec in SDP. If param does not exists, add it.
function setCodecParam (sdp, codec, param, value) {
  const sdpLines = sdp.split('\r\n')

  const fmtpLineIndex = findFmtpLine(sdpLines, codec)

  let fmtpObj = {}
  if (fmtpLineIndex === null) {
    const index = findLine(sdpLines, 'a=rtpmap', codec)
    if (index === null) {
      return sdp
    }
    const payload = getCodecPayloadTypeFromLine(sdpLines[index])
    fmtpObj.pt = payload.toString()
    fmtpObj.params = {}
    fmtpObj.params[param] = value
    sdpLines.splice(index + 1, 0, writeFmtpLine(fmtpObj))
  } else {
    fmtpObj = parseFmtpLine(sdpLines[fmtpLineIndex])
    fmtpObj.params[param] = value
    sdpLines[fmtpLineIndex] = writeFmtpLine(fmtpObj)
  }

  sdp = sdpLines.join('\r\n')
  return sdp
}

// Remove fmtp param if it exists.
function removeCodecParam (sdp, codec, param) {
  const sdpLines = sdp.split('\r\n')

  const fmtpLineIndex = findFmtpLine(sdpLines, codec)
  if (fmtpLineIndex === null) {
    return sdp
  }

  const map = parseFmtpLine(sdpLines[fmtpLineIndex])
  delete map.params[param]

  const newLine = writeFmtpLine(map)
  if (newLine === null) {
    sdpLines.splice(fmtpLineIndex, 1)
  } else {
    sdpLines[fmtpLineIndex] = newLine
  }

  sdp = sdpLines.join('\r\n')
  return sdp
}

// Split an fmtp line into an object including 'pt' and 'params'.
function parseFmtpLine (fmtpLine) {
  const fmtpObj = {}
  const spacePos = fmtpLine.indexOf(' ')
  const keyValues = fmtpLine.substring(spacePos + 1).split(';')

  const pattern = new RegExp('a=fmtp:(\\d+)')
  const result = fmtpLine.match(pattern)
  if (result && result.length === 2) {
    fmtpObj.pt = result[1]
  } else {
    return null
  }

  const params = {}
  for (let i = 0; i < keyValues.length; ++i) {
    const pair = keyValues[i].split('=')
    if (pair.length === 2) {
      params[pair[0]] = pair[1]
    }
  }
  fmtpObj.params = params

  return fmtpObj
}

// Generate an fmtp line from an object including 'pt' and 'params'.
function writeFmtpLine (fmtpObj) {
  if (!Object.prototype.hasOwnProperty.call(fmtpObj, 'pt') ||
    !Object.prototype.hasOwnProperty.call(fmtpObj, 'params')) {
    return null
  }
  const pt = fmtpObj.pt
  const params = fmtpObj.params
  const keyValues = []
  let i = 0
  for (const key in params) {
    if (Object.prototype.hasOwnProperty.call(params, key)) {
      keyValues[i] = key + '=' + params[key]
      ++i
    }
  }
  if (i === 0) {
    return null
  }
  return 'a=fmtp:' + pt.toString() + ' ' + keyValues.join(';')
}

// Find fmtp attribute for |codec| in |sdpLines|.
function findFmtpLine (sdpLines, codec) {
  // Find payload of codec.
  const payload = getCodecPayloadType(sdpLines, codec)
  // Find the payload in fmtp line.
  return payload ? findLine(sdpLines, 'a=fmtp:' + payload.toString()) : null
}

// Find the line in sdpLines that starts with |prefix|, and, if specified,
// contains |substr| (case-insensitive search).
function findLine (sdpLines, prefix, substr) {
  return findLineInRange(sdpLines, 0, -1, prefix, substr)
}

// Find the line in sdpLines[startLine...endLine - 1] that starts with |prefix|
// and, if specified, contains |substr| (case-insensitive search).
function findLineInRange (
  sdpLines,
  startLine,
  endLine,
  prefix,
  substr,
  direction
) {
  if (direction === undefined) {
    direction = 'asc'
  }

  direction = direction || 'asc'

  if (direction === 'asc') {
    // Search beginning to end
    const realEndLine = endLine !== -1 ? endLine : sdpLines.length
    for (let i = startLine; i < realEndLine; ++i) {
      if (sdpLines[i].indexOf(prefix) === 0) {
        if (!substr ||
          sdpLines[i].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
          return i
        }
      }
    }
  } else {
    // Search end to beginning
    const realStartLine = startLine !== -1 ? startLine : sdpLines.length - 1
    for (let j = realStartLine; j >= 0; --j) {
      if (sdpLines[j].indexOf(prefix) === 0) {
        if (!substr ||
          sdpLines[j].toLowerCase().indexOf(substr.toLowerCase()) !== -1) {
          return j
        }
      }
    }
  }
  return null
}

// Gets the codec payload type from sdp lines.
function getCodecPayloadType (sdpLines, codec) {
  const index = findLine(sdpLines, 'a=rtpmap', codec)
  return index ? getCodecPayloadTypeFromLine(sdpLines[index]) : null
}

// Gets the codec payload type from an a=rtpmap:X line.
function getCodecPayloadTypeFromLine (sdpLine) {
  const pattern = new RegExp('a=rtpmap:(\\d+) [a-zA-Z0-9-]+\\/\\d+')
  const result = sdpLine.match(pattern)
  return (result && result.length === 2) ? result[1] : null
}

// Returns a new m= line with the specified codec as the first one.
function setDefaultCodec (mLine, payload) {
  const elements = mLine.split(' ')

  // Just copy the first three parameters; codec order starts on fourth.
  const newLine = elements.slice(0, 3)

  // Put target payload first and copy in the rest.
  newLine.push(payload)
  for (let i = 3; i < elements.length; i++) {
    if (elements[i] !== payload) {
      newLine.push(elements[i])
    }
  }
  return newLine.join(' ')
}
