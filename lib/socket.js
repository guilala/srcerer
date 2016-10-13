/*!
* Srcerer, socket
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const path = require("path");
const util = require("./util");

// load socket.json
const loadConfiguration = function(next) {
   var scriptPath = this.runtime.mount.socket[this.mountPoint];
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

// handle socket events
const startListening = function() {
   require(path.resolve(
      this.root,
      this.conf.script
   )).call(this);
};

// call on socket connection
module.exports = function(ws, runtime) {
   util.que({
      runtime: runtime,
      ws: ws,
      mountPoint: ws.protocol,
      root: undefined,
      conf: {}
   })

   .add(loadConfiguration)
   .then(startListening);
};

