/*!
* Srcerer, io
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
      this.conf = confData;
      next();
   }, (err) => {
      console.error(`loadIoConfiguration, ${scriptPath}: ${err}`);
      this.res.status(500).send("Error: " + this.mountPoint);
   });
};

const runIoScript = function(next) {
   var script = require(path.resolve(
      this.root,
      this.conf.script
   ));

   script.call(this, this.req, this.res, next);
};

module.exports = function (req, res, next) {
   util.que({
      req: req,
      res: res,
      mountPoint: undefined,
      root: undefined,
      conf: {}
   })

   .add(getMountPoint)
   .add(loadIoConfiguration)
   .add(runIoScript)
 
   .then(() => {
      next();
   });
};

