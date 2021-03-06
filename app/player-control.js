import Player from './player'
import WaveSurfer from 'wavesurfer.js'

var playButton = document.querySelector('#play')
var nextButton = document.querySelector('#next')
var pauseButton = document.querySelector('#pause')
var stopButton = document.querySelector('#stop')
var addFile = document.querySelector('#file')
var trackTitle = document.querySelector('#trackTitle')
var muteButton = document.querySelector('#mute')

var player = new Player()

playButton.addEventListener('click', () => {
  if (player.currentSong)
    player.pause()
  else
    player.playLast()
})
nextButton.addEventListener('click', () => {
  player.next()
})
pauseButton.addEventListener('click', () => {
  player.pause()
})
stopButton.addEventListener('click', () => {
  player.stop()
})

var prevLevel = 0
muteButton.addEventListener('click', () => {
  if (player.volumeLevel != 0) {
    prevLevel = player.volumeLevel
    player.setVolume(0)
  }
  else
    player.setVolume(prevLevel || 0.5)
})

addFile.addEventListener('change', () => {
  if (addFile.files.length > 0) {
    var newFile = addFile.files[0]
    player.add(newFile)
    if (!player.currentSong) {
      player.play()
      player.stop()
    }
  }
})

//player.js add trackChange event
var wavesurfer = WaveSurfer.create({
    container: '#waves',
    autoCenter: true,
    progressColor: '#45b8de',
    waveColor: '#000',
    cursorColor: '#333',
    maxCanvasWidth: 800,
})
player.on('playing', (song) => {
  if (player.currentSong) {
    wavesurfer.load(player.currentSong.path);
    //wavesurfer.play()
  }
  trackTitle.innerHTML = song.name

  renderList(player.list)
})
player.on('track:added', () => renderList(player.list))
player.on('track:ended', () => renderList(player.list))

//wavesurfer.load('../audio/song.mp3');

var listEl = document.querySelector('#list')

function renderList(list) {
  var songs = ''
  for(var song of list) {
    if (song._id == player.currentSongId)
      songs += `<li><b>${song.name}</b></li>`
    else
      songs += `<li>${song.name}</li>`
  }
  listEl.innerHTML = songs
}

// print file info
function info(inputFile) {
  var files = inputFile.files
  if (files.length > 0) {
    var firstLenght = files[0].length
    var firstSizeMb = (files[0].size / 1024 / 1024).toFixed(2)
    console.log(`${firstSizeMb}Mb (${files[0].size})`);
    console.log(`selected files ${files.length}`);
  }
}
