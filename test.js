const { fork } = require('child_process');


const params = {
  id: 'telegram',
  hwid: '13582c8df904a9beaa3635b48333ed5ae2e07b7624f69e65b87dfc1f94078d7d-0110',
  port: 8088,
  syspath: '/opt/ih-v5',
  logfile: '/opt/ih-v5/log/telegram.log',
}


const forked = fork('index.js', [JSON.stringify(params), 'debug']);

forked.on('message', (msg) => {
  console.log(msg);
});

/*
forked.send({
  type: 'sub',
  data: {
    sign: 'Title',
    txt: 'Body',
    sendTo: [{ addr: '' }],
  }
})
*/
