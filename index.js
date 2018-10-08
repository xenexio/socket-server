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
      return console.log('NO_TOPIC')
    }
    
    if (!socket.user) {
      return console.log('NOT_SIGNIN')
    }

    let ok = acl.topics.some(aTopic => topic.substr(0, aTopic.prefix.length) === aTopic.prefix &&
      isRoleInList(acl.users[socket.user].roles, aTopic.subscribers)
    )
    if (!ok) {
      return console.log('NOT_AUTHORIZED')
    }
    socket.join(topic)
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
    if (!socket.user) {
      return console.log('NOT_SIGNIN')
    }

    let ok = acl.topics.some(aTopic => topic.substr(0, aTopic.prefix.length) === aTopic.prefix &&
      isRoleInList(acl.users[socket.user].roles, aTopic.publishers)
    )
    if (!ok) {
      return console.log('NOT_AUTHORIZED')
    }
    io.sockets.in(topic).emit(topic, data)
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

function isRoleInList(roles, lists) {
  return roles.some(role => lists.indexOf(role) >= 0)
}
