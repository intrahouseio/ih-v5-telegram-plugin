const plugin = require('ih-plugin-api')();
const Telegram = require('./lib/telegram');

let telegram = null;

let opt = {};
let settings = {};
let users = {};
let channels = [];


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
  opt = plugin.opt;
  settings = await plugin.params.get();
  channels = await plugin.channels.get();

  process.send({ type: 'sub', id: opt.id, event: 'sendinfo', filter: { type: opt.id } });
  process.send({ type: 'get', tablename: 'infousers' });

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

  plugin.onChange('infousers', data => {
    process.exit(0);
  });

  telegram = new Telegram({ token: settings.token, proxy: settings.proxy === 'manual' ? settings.HTTPProxy : (settings.proxy ? settings.proxy : 'disabled') });
  
  telegram.on('debug', telegram_debug);
  telegram.on('msg_text', telegram_message);

  telegram.start();
}

main();

