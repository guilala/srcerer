/*!
* Srcerer, socket
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

const path = require("path");
const util = require("./util");

const getMountPoint = function(next) {
   var basePath = this.req.url.split(path.sep);
   if(basePath.length) {
      basePath.pop(); // remove .websocket
      this.mountPoint = basePath.pop();
      next();
   } else {
      console.error("getMountPoint: unknown");
      this.res.status(500).send("Name unknown");
   }
};

const loadIoConfiguration = function(next) {
   var scriptPath = this.req.runtime.mount.socket[this.mountPoint];
   this.root = path.parse(scriptPath).dir;
   util.localJson(
      scriptPath
   ).then((confData) => {
      this.conf = confData;
      next();
   }, (err) => {
      console.error(`loadIoConfiguration, ${scriptPath}: ${err}`);
      this.res.status(500).send("Error: " + this.mountPoint);
   });
};

const runIoScript = function() {
   var script = require(path.resolve(
      this.root,
      this.conf.script
   ));

   script.call(this, this.ws, this.msg);
};

module.exports = function(ws, req) {
	ws.on("message", function(msg) {
      util.que({
         req: req,
         socketServer: req.runtime.wss,
         ws: ws,
         msg: msg,
         mountPoint: undefined,
         root: undefined,
         conf: {}
      })

      .add(getMountPoint)
      .add(loadIoConfiguration)

      .then(runIoScript);
   });
};

