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
   this.version = "0.10.1";
   this.port = 2000;
   this.domain = "127.0.0.1";
   this.root = "./";
   this.appsRoot = "./";
   this.favicon = false;

   // cookie
   this.cookies = {
      name: "guila.la",
      keys: ["firstKey", "secondKey"],
      secret: "Something secret",
      cookie: {
         path: "/",
         httpOnly: false,
         maxAge: 3600000
      }
   };

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

