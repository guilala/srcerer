/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

/*jslint node: true */
"use strict";

var server = require("./lib/server");

module.exports = function (extConf) {
   const configuration = this;

   // general
   this.name = "Srcerer";
   this.version = "0.12.0";
   this.port = 2000;
   this.domain = "127.0.0.1";
   this.root = "./";
   this.appsRoot = "./";

   // main
   this.start = function() {
      // map external to internal configuration
      for(var key in extConf) {
         if(extConf.hasOwnProperty(key) && configuration.hasOwnProperty(key)){
            configuration[key] = extConf[key];
         }
      }
      server(configuration);
   };
};

