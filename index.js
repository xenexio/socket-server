const fs = require('fs')
const path = require('path')

const config = require('./config')
const io = require('socket.io')(config.port)

const dayjs = require('dayjs')

let acl = {
  users: [],
  topics: [],
}

const reservedTopics = ['connect', 'connection', 'disconnect', 'publish', 'subscribe', 'unsubscribe']

loadAcl()

io.on('connection', function (socket) {
  console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'CONNECTED, client=', socket.id)
  socket.on('signin', (auth) => {
    let user = acl.users[auth.user]
    if (user && user.pass === auth.pass) {
      socket.user = auth.user
    } else {
      console.log('INVALID USER/PASS')
    }
  })
  socket.on('subscribe', (topic) => {
    console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'SUBSCRIBE, client=', socket.id, ', topic=', topic)
    if (!topic) {
      return
    }

    try {
      Object.keys(acl.topics).forEach((i) => {
        if ( topic.indexOf(acl.topics[i].prefix) === 0) {
          if (!socket.user) {
            throw 'NOT_AUTHORIZED'
          }
          let roles = acl.users[socket.user].roles
          if (!checkAcl(roles, acl.topics[i].subscribers)) {
            throw 'NOT_AUTHORIZED2'
          }
        }
      })
      socket.join(topic)
    } catch (e) {
      console.log('error', e)
    }
  })

  socket.on('unsubscribe', (topic) => {
    console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'UNSUBSCRIBE, client=', socket.id, ', topic=', topic)
    if (topic) {
      socket.leave(topic)
    }
  })

  socket.on('publish', (topic, data) => {
    console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'PUBLISH, client=', socket.id, ', topic=', topic, ', payload=', data)
    if (reservedTopics.indexOf(topic) !== -1) {
      console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'ERROR=RESERVED_TOPIC')
      return
    }
    try {
      Object.keys(acl.topics).forEach((i) => {
        if ( topic.indexOf(acl.topics[i].prefix) === 0) {
          if (!socket.user) {
            throw 'NOT_AUTHORIZED'
          }
          let roles = acl.users[socket.user].roles
          if (!checkAcl(roles, acl.topics[i].publishers)) {
            throw 'NOT_AUTHORIZED2'
          }
        }
      })
      io.sockets.in(topic).emit(topic, data)
    } catch (e) {
      console.log('error', e)
    }
    // broadcast to all members in room/topic INCLUDE yourself
    // broadcast to all members in room/topic EXCEPT yourself
    // socket.to(topic).emit(topic, data)
  })

  socket.on('disconnect', () => {
    console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'DISCONNECTED, client=', socket.id)
  })
})

console.log(dayjs().format('YYYY-MM-DD HH:mm:ss'), 'READY ON', config.port)

function loadAcl() {
  try {
    acl = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'acl.json'), 'utf8'))
  } catch (e) {
    console.log('sorry')
  }
}

function checkAcl(roles, lists) {
  let found = false
  console.log('roles=', roles, lists)
  for (let i = 0; i < roles.length; i++) {
    if (lists.indexOf(roles[i]) >= 0) {
      found = true
      break
    }
  }
  return found
}
