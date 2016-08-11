/*!
 * Srcerer, io
 * Copyright(c) 2010-2015 Jesse Tijnagel
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

const runIoScript = function(next) {
   var script = require(path.resolve(
      this.root,
      this.mountPoint
   ));

   script.call(this, this.req, this.res, next);
};

module.exports = function (req, res, next) {
   util.que({
      req: req,
      res: res,
      mountPoint: undefined,
      root: undefined,
      ioConf: undefined
   })

   .add(getMountPoint)
   .add(loadIoConfiguration)
   .add(runIoScript)
   .then(() => {
      next();
   });
};

