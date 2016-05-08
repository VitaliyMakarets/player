import fs from 'fs'
import path from 'path'
import util from "util"
import { http, https } from 'follow-redirects'
import home from 'home'
import lame from 'lame'
import _ from 'underscore'
import Speaker from 'speaker'
import PoolStream from 'pool_stream'
import Volume from 'pcm-volume'
import { EventEmitter } from "events"
import { fetchName, splitName, format, getProgress, chooseRandom } from './utils'

const defaults = {
  'src': 'src',
  'cache': false,
  'stream': false,
  'shuffle': false,
  'downloads': home(),
  'http_proxy': process.env.HTTP_PROXY || process.env.http_proxy || null,
}

export default class Player extends EventEmitter {
  constructor() {
    super()
    this.history = []
    this.paused = false
    this.options = []
    this._list = []
    this._currentSong = null
  }

  get list() {
    if (!this._list)
      return
    return this._list
  }

  // Get the lastest playing song
  get playing() {
    if (!this.history.length)
      return null

    return this._list[this.history[this.history.length - 1]]
  }

  get currentSong() {
    return this._currentSong
  }

  get currentSongId() {
    return this.currentSong ? this.currentSong._id : null
  }

  get nextSong() {
    let found = this._list.filter((song) => song._id == playing._id)
    if (found.length > 0)
      return found[0]
    return
  }

  get volumeLevel() {
    return this.volume ? this.volume.volume : 0
  }

  playLast() {
    var size = this._list.length
    if (size > 0) {
      var lastIndex = size - 1
      this.play(lastIndex)
    }
  }

  play(index = 0) {
    if (this._list.length <= 0)
      return

    if (this.currentSong)
      this.stop()

    if (!_.isNumber(index))
      index = 0
    if (index >= this._list.length) index = this._list.length - 1

    let self = this
    let song = this._list[index]

    this.paused = false
    this.read(song.path, (err, pool) => {
      self.pool = pool
      if (err) {
        this.end()
        return this.emit('error', err)
      }

      this.meta(pool, (err, data) => {
        if (!err)
          song.meta = data
      })

      this.lameStream = new lame.Decoder()

      pool
        .pipe(this.lameStream)
        .once('format', onPlaying)
        .once('finish', () => {
          self.emit('track:ended', song)
          if (self.nextSong)
            self.next()
        })

      function onPlaying(f) {
        self.lameFormat = f
        self.volume = new Volume()
        self.speaker = new Speaker(self.lameFormat)
        self._readableStream = this
        self.volume.pipe(self.speaker)

        self._currentSong = song
        self.emit('playing', song)
        self.history.push(index)

        // This is where the song actually played end,
        // can't trigger playend event here cause
        // unpipe will fire this speaker's close event.
        this.pipe(self.volume)
          .once('close', () =>
            self.emit('playend', song))
      }
    })
    return this
  }

  setVolume(level) {
    if(!this.volume)
      return
    this.volume.setVolume(level)
  }

  /**
   * [Read MP3 src and check if we're going to download it.]
   * @param  {String}   src      [MP3 file src, would be local path or URI (http/https)]
   * @param  {Function} callback [callback with err and file stream]
   */
  read(src, callback) {
    var isLocal = !(src.indexOf('http') == 0 || src.indexOf('https') == 0)

    // Read local file stream if not a valid URI
    if (isLocal)
      return callback(null, fs.createReadStream(src))

    var file = path.join(
      this.options.downloads,
      fetchName(src)
    )

    if (fs.existsSync(file))
      return callback(null, fs.createReadStream(file))

    this.download(src, callback)
  }

  pause() {
    if (this.paused) {
      this.emit('unpause', this._currentSong)
      this.volume = new Volume()
      this.speaker = new Speaker(this.lameFormat)
      this.volume.pipe(this.speaker)
      this.lameStream.pipe(this.speaker)
    } else {
      this.volume.end()
      this.emit('pause', this._currentSong)
      //this.speaker.close() // not pausing but just stops playback
    }

    this.paused = !this.paused
    return this
  }

  stop() {
    if (!this.volume)
      return
    this._readableStream.unpipe()
    this.volume.end()

    this.speaker.close()
    let song = this._currentSong
    this._currentSong = null
    this.emit('track:ended', song)
    return
  }

  next() {
    let list = this._list
    let current = this.playing
    let nextIndex = this.options.shuffle ?
      chooseRandom(_.difference(list, [current._id])) :
      current._id + 1

    if (nextIndex >= list.length) {
      this.emit('error', 'No next song was found')
      this.emit('finish', current)
      return this
    }

    this.stop()
    this.play(nextIndex)

    return this
  }

  /**
   * [Add a new song to the playlist,
   * If provided `song` is a String, it will be converted to a `Song` Object.]
   * @param {String|Object} song [src URI of new song or the object of new song.]
   */
  add(song) {
    var latest = _.isObject(song) ? song : {}

    latest._id = this._list.length

    if (_.isString(song)) {
      latest._name = splitName(song)
      latest[this.options.src] = song
    }

    this._list.push(latest)

    this.emit('track:added', latest)
  }

  /**
   * [Download a mp3 file from its URI]
   * @param  {String}   src      [the src URI of mp3 file]
   * @param  {Function} callback [callback with err and file stream]
   */
  download(src, callback) {
    var self = this
    var called = false
    var proxyReg = /http:\/\/((?:\d{1,3}\.){3}\d{1,3}):(\d+)/
    var http_proxy = self.options.http_proxy
    var request = src.indexOf('https') === 0 ? https : http
    var query = src

    if (http_proxy && proxyReg.test(http_proxy)) {
      var proxyGroup = http_proxy.match(proxyReg)
      query = {}
      query.path = src
      query.host = proxyGroup[1]
      query.port = proxyGroup[2]
    }

    request
      .get(query, responseHandler)
      .once('error', errorHandler)

    function responseHandler(res) {
      called = true

      var isOk = (res.statusCode === 200)
      var isAudio = (res.headers['content-type'].indexOf('audio/mpeg') > -1)
      var isSave = self.options.cache
      var isStream = self.options.stream

      if (!isOk)
        return callback(new Error('Resource invalid'))
      if (isStream)
        return callback(null, res)
      if (!isAudio)
        return callback(new Error('Resource type is unsupported'))

      // Create a pool
      var pool = new PoolStream()
      // Pipe into memory
      res.pipe(pool)

      // Check if we're going to save this stream
      if (!isSave)
        return callback(null, pool)

      // Save this stream as file in download directory
      var file = path.join(
        self.options.downloads,
        fetchName(src)
      )

      self.emit('downloading', src)
      pool.pipe(fs.createWriteStream(file))

      // Callback the pool
      callback(null, pool)
    }

    function errorHandler(err) {
      if (!called)
        callback(err)
    }
  }

  // Fetch metadata from local or remote mp3 stream
  meta(stream, callback) {
    try {
      var mm = require('musicmetadata')
    } catch (err) {
      return callback(err)
    }

    var options = {
      'duration': true
    }

    stream.on('error', err =>
      this.emit('error', `出错了 ${err.code}: ${err.path}`))

    return mm(stream, options, callback)
  }

  // Format metadata with template
  // And output to `stdout`
  progress(metadata) {
    var total = 70
    var info = metadata.title
    var duration = parseInt(metadata.duration)
    var dots = total - 1
    var speed = (duration * 1000) / total
    var stdout = process.stdout

    require('async').doWhilst(
      (callback) => {
        // Clear console
        stdout.write('\u001B[2J\u001B[00f')

        // Move cursor to beginning of line
        stdout.cursorTo(0)
        stdout.write(getProgress(total - dots, total, info))

        setTimeout(callback, speed)

        dots--
      },
      () => dots > 0,
      (done) => {
        stdout.moveCursor(0, -1)
        stdout.clearLine()
        stdout.cursorTo(0)
      }
    )
  }
}
