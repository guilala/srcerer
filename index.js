/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */
var server = require("./lib/server");

module.exports = function (extConf) {
   var configuration = this;

   this.name = "Srcerer";
   this.version = "0.6.12";
   this.port = 2000;
   this.domain = "127.0.0.1";
   this.root = "./"
   this.appsRoot = "./";

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

   // back end modules
   this.modules = [

   ];

   // web socket connections
   this.sockets = [

   ];

   // main
   this.start = function(){
      // map external to internal configuration
      for(key in extConf){
         if(extConf.hasOwnProperty(key) && configuration.hasOwnProperty(key)){
            configuration[key] = extConf[key];
         }
      }
      server(configuration);
   };
};
