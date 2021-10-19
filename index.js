const plugin = require('ih-plugin-api')();

const logger = require('./lib/logger');
const Telegram = require('./lib/telegram');

let telegram = null;

let settings = {};
let users = {};
let channels = [];

function sendProcessInfo() {
  const mu = process.memoryUsage();
  const memrss = Math.floor(mu.rss / 1024);
  const memheap = Math.floor(mu.heapTotal / 1024);
  const memhuse = Math.floor(mu.heapUsed / 1024);

  const data = { memrss, memheap, memhuse };

  process.send({ type: 'procinfo', data });
}

function telegram_debug(msg) {
  plugin.log(msg);
}

function telegram_message({ from, text }) {
  const user = users[from.id];
  if (user) {
    plugin.log(`registered: msg -> id:${from.id}, text:${text}`);

    const values = [];
    
    channels.forEach(item => {
      values.push({ id: item.id, value: text, ext: { userid: from.id, update: Date.now()} });
      values.push({ id: item.id, value: '#' + text, ext: { userid: from.id, update: Date.now()} });
    });

    plugin.sendData(values);
  } else {
    plugin.log(`not registered: msg -> id:${from.id}, text:${text}`);
    telegram.sendText(from.id, `User is not registered ${from.id}.`);
  }
}

async function main() {
  let opt;
  try {
    opt = JSON.parse(process.argv[2]);
  } catch (e) {
    opt = {};
  }

  const logfile = opt.logfile || path.join(__dirname, 'ih_telegram.log');
  const loglevel = opt.loglevel || 0;

  logger.start(logfile, loglevel);
  logger.log('Plugin telegram has started  with args: ' + process.argv[2]);

  setInterval(sendProcessInfo, 10000);


  process.on('message', msg => {
    if (typeof msg === 'object' && msg.type === 'sub' && msg.data !== undefined) {
      msg.data.sendTo.forEach(user => {
        if (msg.data.img === undefined) {
          plugin.log(`send_txt -> id:${user.addr}, text:${msg.data.txt}`)
          telegram.sendText(user.addr, msg.data.txt);
        } else {
          plugin.log(`send_img -> id:${user.addr}, text:${msg.data.txt}`)
          telegram.sendImg(user.addr, msg.data.img, msg.data.txt);
        }
      });
    }

    if (typeof msg === 'object' && msg.type === 'get' && msg.infousers !== undefined) {
      msg.infousers.forEach(i => { users[i.addr] = true });
    }
  });


  process.send({ 
    type: 'sub',
    id: opt.id,
    event: 'sendinfo',
    filter: { type: opt.id }
  });

  process.send({ type: 'get', tablename: 'infousers' });

  settings = await plugin.params.get();
  channels = await plugin.channels.get();

  telegram = new Telegram({ token: settings.token, proxy: settings.proxy === 'manual' ? settings.HTTPProxy : (settings.proxy ? settings.proxy : 'disabled') });
  
  telegram.on('debug', telegram_debug);
  telegram.on('msg_text', telegram_message);

  telegram.start();
}

main();

