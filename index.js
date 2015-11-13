/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */
var server = require("./lib/server");

module.exports = function () {
   var conf = this;

   this.name = "Srcerer";
   this.version = "0.6.2";
   this.port = 2000;
   this.domain = "127.0.0.1";
   this.npm = "/usr/local/lib/node_modules/npm";
   this.app = ".";

   // Mongodb connections
   this.db = {

   };

   // back end modules
   this.modules = [

   ];

   // web socket connections
   this.sockets = [

   ];

   // main
   this.start = function(directConf){
      server(directConf || conf);
   };
};
