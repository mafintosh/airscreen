#!/usr/bin/env node

var proc = require('child_process')
var pump = require('pump')
var path = require('path')
var airpaste = require('airpaste')
var lpm = require('length-prefixed-message')
var fs = require('fs')

var stream = airpaste(process.argv[2])
var token = Date.now() + '.' + Math.random().toString(16).slice(2)

lpm.write(stream, token)
lpm.read(stream, function (message) {
  var initiator = isInitiator(message.toString())
  if (initiator) {
    proc.spawn('screen', ['-S', token], {stdio: 'inherit'})
  }

  screenDir(function (err, dir) {
    if (err) throw err

    if (!initiator) {
      var pipe = path.join(dir, token + '.airscreen')
      proc.exec('mkfifo -m 0700 ' + JSON.stringify(pipe), function (err) {
        if (err) throw err
        pump(fs.createReadStream(pipe), stream, fs.createWriteStream(pipe))
        proc.spawn('screen', ['-x', token + '.airscreen'], {stdio: 'inherit'}).on('exit', unlink)
      })

      function unlink (code) {
        fs.unlink(pipe, function () {
          process.exit()
        })
      }
    } else {
      fs.readdir(dir, function (err, files) {
        if (err) throw err
        var name = files.filter(function (name) {
          return name.indexOf(token) > -1
        })[0]

        var pipe = path.join(dir, name)
        pump(fs.createReadStream(pipe), stream, fs.createWriteStream(pipe))
      })
    }
  })
})

function isInitiator (otherToken) {
  var time = Number(token.split('.')[0])
  var otherTime = Number(otherToken.split('.')[0])

  if (time === otherTime) return token < otherToken
  return time < otherTime
}

function screenDir (cb) {
  proc.exec('screen -ls', function (_, dir) {
    if (!dir) return cb(new Error('cmd failed'))
    cb(null, dir.trim().split('\n').pop().replace(/\.$/, '').replace(/^[^\/]+\//, '/'))
  })
}
