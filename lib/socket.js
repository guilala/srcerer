/*!
* Srcerer, socket
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

const path = require("path");
const util = require("./util");

const getMountPoint = function(next) {
   var basePath = this.req.baseUrl.split(path.sep);
   if(basePath.length) {
      this.mountPoint = basePath.pop();
      next();
   } else {
      console.error("getMountPoint: unknown");
      this.res.status(500).send("Name unknown");
   }
};

const loadIoConfiguration = function(next) {
   var scriptPath = this.req.runtime.mount.io[this.mountPoint];
   this.root = path.parse(scriptPath).dir;
   util.localJson(
      scriptPath
   ).then((confData) => {
      this.ioConf = confData;
      next();
   }, (err) => {
      console.error(`loadIoConfiguration, ${scriptPath}: ${err}`);
      this.res.status(500).send("Error: " + this.mountPoint);
   });
};

const runIoScript = function() {
   var script = require(path.resolve(
      this.root,
      this.mountPoint
   ));

   script.call(this, this.ws, this.msg);
};

module.exports = function(ws, req) {
   ws.on("message", function(msg) {
      util.que({
         req: req,
         ws: ws,
         msg: msg,
         mountPoint: undefined,
         root: undefined,
         ioConf: undefined
      })

      .add(getMountPoint)
      .add(loadIoConfiguration)
      .then(runIoScript);

      console.log("Websocket got a msg");
      ws.send(msg);
   });
};

