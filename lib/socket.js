/*!
* Srcerer, socket
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

module.exports = function (req, res, next) {
   console.log("socket.js");
   /*
   var socket = new socketServer({server: server});
   var socketModules = {};
   conf.sockets.forEach(function (m) {
   if (m.host === "*" || m.host.indexOf(host) >= 0) {
   var modulePath = root + m.path;
   if(fs.existsSync(modulePath)){
      console.log("\x1b[35mRequire socket module\x1b[0m '%s'", m.mount, modulePath);
      socketModules[m.mount] = require(modulePath);
   } else console.log("Cannot find %s", modulePath);
   }
   });

   // socket module mounting
   socket.on("connection", function connection(client) {
   var mount = function (str) {
   try {
      var msg = JSON.parse(str);
      if (msg.hasOwnProperty("mount")) {
      if (socketModules.hasOwnProperty(msg.mount)) {
      client.removeListener("message", mount);
      console.log("Socket module '%s', new client", msg.mount);
      client.send(JSON.stringify({
         mount: msg.mount
      }));
      socketModules[msg.mount](client);
      } else {
      client.send(JSON.stringify({
         mount: false
      }));
      }
      }
   } catch (e) {
      console.error(e);
   }
   };

   client.on("message", mount);
   });*/
};

