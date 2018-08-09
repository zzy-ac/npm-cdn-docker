const http = require('http');
const https = require('https');
const URL = require('url');
const fs = require('fs');
const path = require('path');

/*
disturl https://npm.taobao.org/dist # node-gyp 编译依赖的 node 源码镜像
sass_binary_site https://npm.taobao.org/mirrors/node-sass # node-sass 二进制包镜像
electron_mirror https://npm.taobao.org/mirrors/electron/ # electron 二进制包镜像
puppeteer_download_host https://npm.taobao.org/mirrors # puppeteer 二进制包镜像
chromedriver_cdnurl https://npm.taobao.org/mirrors/chromedriver # chromedriver 二进制包镜像
operadriver_cdnurl https://npm.taobao.org/mirrors/operadriver # operadriver 二进制包镜像
phantomjs_cdnurl https://npm.taobao.org/mirrors/phantomjs # phantomjs 二进制包镜像
selenium_cdnurl https://npm.taobao.org/mirrors/selenium # selenium 二进制包镜像
node_inspector_cdnurl https://npm.taobao.org/mirrors/node-inspector # node-inspector 二进制包镜像
*/

const mirrors = [
  ['https://npm.taobao.org/dist', '/node-dist'],
  ['https://npm.taobao.org/mirrors/node-sass', '/node-sass'],
  ['https://npm.taobao.org/mirrors/electron', '/electron'],
  ['https://npm.taobao.org/mirrors/chromedriver', '/chromedriver'],
  ['https://npm.taobao.org/mirrors/operadriver', '/operadriver'],
  ['https://npm.taobao.org/mirrors/phantomjs', '/phantomjs'],
  ['https://npm.taobao.org/mirrors/selenium', '/selenium'],
  ['https://npm.taobao.org/mirrors/node-inspector', '/node-inspector'],
];

const MIRRORS_PATH = process.env.MIRRORS_PATH || './mirrors';
const PORT = process.env.NODE_PORT || 80;

const ensureDirExists = (targetDir, isRelativeToScript = false) => {
  const sep = path.sep;
  const initDir = path.isAbsolute(targetDir) ? sep : '';
  const baseDir = isRelativeToScript ? __dirname : '.';

  return targetDir.split(sep).reduce((parentDir, childDir) => {
    const curDir = path.resolve(baseDir, parentDir, childDir);
    try {
      const stat = fs.lstatSync(curDir);
      if (!stat.isDirectory()) fs.unlinkSync(curDir);
    } catch(err) {}

    try {
      fs.mkdirSync(curDir);
    } catch (err) {
      if (err.code === 'EEXIST') { // curDir already exists!
        return curDir;
      }

      // To avoid `EISDIR` error on Mac and `EACCES`-->`ENOENT` and `EPERM` on Windows.
      if (err.code === 'ENOENT') { // Throw the original parentDir error on curDir `ENOENT` failure.
        throw new Error(`EACCES: permission denied, mkdir '${parentDir}'`);
      }

      const caughtErr = ['EACCES', 'EPERM', 'EISDIR'].indexOf(err.code) > -1;
      if (!caughtErr || caughtErr && targetDir === curDir) {
        throw err; // Throw if it's just the last created dir.
      }
    }

    return curDir;
  }, initDir);
};

const makeFetch = (fullUrl, cb) => {
  const { host, protocol, path: p } = URL.parse(fullUrl);
  (protocol === 'https:' ? https : http)['get'](fullUrl, (resp) => {
    if ([301, 302, 307, 308].includes(resp.statusCode)) {
      const url = resp.headers.location;
      makeFetch(url, cb);
    } else {
      cb(resp);
    }
  });
};

const app = (req, res) => {
  const { url } = req;

  const match = mirrors.some(([cdnUrl, prefix]) => {


    if (prefix === url.slice(0, prefix.length)) {
      const localPath = path.join(MIRRORS_PATH, URL.parse(url).pathname);

      fs.access(localPath, fs.constants.F_OK, (err) => {
        if (err) {
          const fullUrl = cdnUrl + url.slice(prefix.length);
          const { host, protocol, path: p } = URL.parse(fullUrl);

          makeFetch(fullUrl, (reqRes) => {
            res.writeHead(reqRes.statusCode, reqRes.statusMesage, reqRes.headers);

            const dir = path.dirname(localPath);
            ensureDirExists(dir);
            const inComming = localPath + '.incomming';
            const ws = fs.createWriteStream(inComming);
            reqRes.on('data', (chunck) => {
              ws.write(chunck);
              res.write(chunck);
            });
            reqRes.on('end', (ed) => {
              ws.end();
              fs.rename(inComming, localPath, () => res.end());
            });
          });
        } else {
          const rs = fs.createReadStream(localPath);
          res.writeHead(200, 'OK', {});
          rs.on('data', (chunck) => res.write(chunck));
          rs.on('end', () => res.end());
        }
      });

      return true;
    }
    return false;
  });

  if (!match) {
    res.writeHead(404, 'Not Found', {});
    res.end();
  }
};

const server = http.createServer(app);

server.listen(PORT, () => console.log(`listen on port ${PORT}`));



