const EventEmitter = require('events');
const request = require('request');
const fs = require('fs');


class Telegram extends EventEmitter {

  constructor(options) {
    super();
    this.options = {
      interval: 10,
      proxy: null,
      sendError: 12,
      sendTimeout: 10,
      proxyError: 3,
      proxyTimeout: 15,
      ...options,
    };
    this.params = {
      offset: 0,
      proxy: null,
      poll_req: null,
      poll_timer: null,
      poll_error: 0,
    };
  }

  requestSendMessage(id, msg, notification = true, callback) {
    return request.post({
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      url: `https://api.telegram.org/bot${this.options.token}/sendMessage`,
      proxy: this.params.proxy,
      body: `chat_id=${id}&text=${msg}&parse_mode=markdown&disable_notification=${!notification}`,
    }, (error, response, body) => {
      if (error) {
        callback(true);
      } else {
        callback(null);
      }
    });
  }

  requestSendImgMessage(id, path_img, msg, notification = true, callback) {
    if (fs.existsSync(path_img)) {
      const formData = {
        chat_id: id,
        caption: msg,
        disable_notification: String(!notification),
        photo: fs.createReadStream(path_img),
      }
      return request.post({
        url: `https://api.telegram.org/bot${this.options.token}/sendPhoto`,
        proxy: this.params.proxy,
        formData,
      }, (error, response, body) => {
        if (error) {
          callback(true);
        } else {
          callback(null);
        }
      });
    } else {
      callback(true);
    }
  }



  sendText(id, msg, notification) {
    const SEND_ERROR = this.options.sendError;
    const SEND_TIMEOUT = this.options.sendTimeout
    const req = this.requestSendMessage.bind(this);
    let error = 0;

    function check(err) {
      if (err) {
        this.emit('debug', 'error: fail send msg');
        error++;
        if (error <= SEND_ERROR) {
          if (this.options.proxy === 'auto') {
            this.getProxy(host => {
              if (host !== null) {
                this.emit('debug', `proxy: ${host}`);
                this.params.proxy = `http://${host}`;
              } else {
                this.emit('debug', 'proxy: not found');
              }
              this.emit('debug', 'restart: try send msg');
              setTimeout(() => req(id, msg, notification, check.bind(this)), SEND_TIMEOUT  * 1000);
            });
          } else {
            this.emit('debug', 'restart: try send msg');
            setTimeout(() => req(id, msg, notification, check.bind(this)), SEND_TIMEOUT  * 1000);
          }
        }
      }
    }
    req(id, msg, notification, check.bind(this));
  }

  sendImg(id, path_img, msg, notification) {
    const SEND_ERROR = this.options.sendError;
    const SEND_TIMEOUT = this.options.sendTimeout
    const req_img = this.requestSendImgMessage.bind(this);
    let error = 0;

    function check(err) {
      if (err) {
        this.emit('debug', 'error: fail send msg');
        error++;
        if (error <= SEND_ERROR) {
          if (this.options.proxy === 'auto') {
            this.getProxy(host => {
              if (host !== null) {
                this.emit('debug', `proxy: ${host}`);
                this.params.proxy = `http://${host}`;
              } else {
                this.emit('debug', 'proxy: not found');
              }
              this.emit('debug', 'restart: try send msg');
              setTimeout(() => req_img(id, path_img, msg, notification, check.bind(this)), SEND_TIMEOUT  * 1000);
            });
          } else {
            this.emit('debug', 'restart: try send msg');
            setTimeout(() => req_img(id, path_img, msg, notification, check.bind(this)), SEND_TIMEOUT  * 1000);
          }
        }
      }
    }
    req_img(id, path_img, msg, notification, check.bind(this));
  }

  checkProxy(host, callback) {
    return request({ url: 'https://api.telegram.org/bot/test', proxy: `http://${host}` }, (error, response, body) => {
      if (error === null && response.statusCode === 404 ) {
        callback(host);
      }
    });
  }


  getProxy(callback) {
    const temp = { list: [], enabled: true };
    const timer = setTimeout(check, this.options.proxyTimeout * 1000);

    function check() {
      if (temp.enabled) {
        callback(null);
      }
    }

    function result(host) {
      if (temp.enabled) {
        temp.enabled = false;
        clearTimeout(timer);
        temp.list.forEach(item => {
          item.abort();
        });
        temp.list = null;
        callback(host);
      }
    }

    request('https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list.txt', (error, response, body) => {
      if (error === null && response.statusCode === 200) {
        const data = body.split('\n').slice(4, -2);
        data.forEach(item => {
          const parse = item.split(' ');
          const host = parse[0];
          temp.list.push(this.checkProxy(host, result));
        });
      }
    });
  }

  parseMessages(messages) {
    const count = messages.length;
    if (count) {
      this.params.offset = messages[count-1].update_id + 1;
    }
    messages.forEach(item => {
      if (item.message.hasOwnProperty('text')) {
        this.emit('msg_text', item.message);
      }
    });
  }

  requestGetMessages() {
    return request({
      url: `https://api.telegram.org/bot${this.options.token}/getUpdates?offset=${this.params.offset}`,
      proxy: this.params.proxy,
    }, (error, response, body) => {
      if (error) {
        this.pollingError();
      } else {
        this.poll_req = null;
        if (response.statusCode === 200) {
          try {
            const json = JSON.parse(body);
            if (json.ok && json.result) {
              this.parseMessages(json.result);
            }
          } catch (e) {
            // console.log('JSON_PARSE_ERROR:', 'Messages parse fail!');
          }
        }
      }
    });
  }

  getMessages() {
    if (this.poll_req) {
      this.poll_req.abort();
    }
    this.poll_req = this.requestGetMessages();
  }

  pollingError() {
    this.emit('debug', 'polling: error');
    if (this.options.proxy === 'auto') {
      this.params.poll_error++;
      if (this.params.poll_error === this.options.proxyError) {
        this.emit('debug', 'polling: stop');
        clearInterval(this.params.poll_timer);
        this.params.poll_error = 0;
        this.start();
      }
    }
  }

  pollingStart() {
    this.emit('debug', 'polling: start');
    if (this.params.poll_timer) {
      clearInterval(this.params.poll_timer);
    }
    this.poll_error = 0;
    this.params.poll_timer = setInterval(this.getMessages.bind(this), this.options.interval * 1000);
    this.getMessages();
  }

  start() {
    if (this.options.proxy === 'auto') {
      this.emit('debug', 'proxy: auto');
      this.getProxy(host => {
        if (host !== null) {
          this.emit('debug', `proxy: ${host}`);
          this.params.proxy = `http://${host}`;
          this.pollingStart();
        } else {
          this.emit('debug', 'proxy: not found');
          this.start();
        }
      });
    } else {
      if (typeof this.options.proxy === 'string' && this.options.proxy !== 'disabled') {
        this.params.proxy = `http://${this.options.proxy}`;
      } else {
        this.emit('debug', 'proxy: false');
      }
      this.pollingStart();
    }
  }

}

module.exports = Telegram;
