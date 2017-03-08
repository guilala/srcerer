/*!
* Srcerer, io
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const path = require("path");
const util = require("./util");

const runIoScript = function(next) {
   var script = require(path.resolve(
      this.root,
      this.configuration.script
   ));

   script.call(this);
};

module.exports = function (req, res, next) {
   // this = {
   //    configuration
   //    configurationFilePath
   //    express: {
   //       req
   //       res
   //       next
   //    },
   //    mountType
   //    mountPoint
   //    root
   //    util
   // }

   util.que(this)
   .add(runIoScript)
   .then(this.express.next);
};

