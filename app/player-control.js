import Player from './player'

var playButton = document.querySelector('#play')
var nextButton = document.querySelector('#next')
var pauseButton = document.querySelector('#pause')
var stopButton = document.querySelector('#stop')
var addFile = document.querySelector('#file')
var trackTitle = document.querySelector('#trackTitle')
var muteButton = document.querySelector('#mute')

var currentFile = ''
var player = new Player()

playButton.addEventListener('click', () => {
  if (currentFile) {
    console.log('playing' + currentFile.name)
  }
  player.playLast()
})
nextButton.addEventListener('click', () => {
  player.next()
  renderList(player.list)
})
pauseButton.addEventListener('click', () => {
  player.pause()
  console.log('pause pressed')
})
stopButton.addEventListener('click', () => {
  player.stop()
  console.log("stop pressed")
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
    currentFile = addFile.files[0]
    player.add(currentFile)
    if (!player.playing)
      player.play()
    renderList(player.list)
    trackTitle.innerHTML = currentFile.name
    info(addFile)
  }
})

var listEl = document.querySelector('#list')

function renderList(list) {
  var songs = ''
  var currentSong = player.playing
  for(var song of list) {
    if (currentSong && song._id == currentSong._id)
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
