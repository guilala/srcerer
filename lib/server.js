/*!
* Srcerer
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/
(function(){
   // require
   var os = require("os");
   var fs = require("fs-extra");
   var path = require("path");
   var express = require("express");
   var socketServer = require("ws").Server;
   var compression = require("compression");
   var cookieParser = require("cookie-parser");
   var cookieSession = require("cookie-session");
   var bodyParser = require("body-parser");

   // local
   var util = require("./util");
   var build = require("./build");

   // env
   var conf;
   var app;
   var server;
   var host = os.hostname();
   var root = path.dirname(require.main.filename) + "/";
   var mainQue = new util.Que(this);
   var mountedModuleNames = [];

   // conditions
   mainQue.push(function(resolve){
      if(
         conf &&
         conf.domain
      ) resolve();
      else console.error("Unmet conditions");
   });

   // configure express
   mainQue.push(function(resolve){
      app = express();
      app.set("env", "production");
      app.set("title", conf.name);
      app.set("version", conf.version);
      app.set("trust proxy", conf.domain); // X-Forwarded-* headers
      app.use(compression());
      app.use(cookieParser());
      app.use(cookieSession(conf.cookies));
      app.use(bodyParser.json());
      app.use(bodyParser.urlencoded({
         extended: true
      }));
      resolve();
   });

   // mount http
   mainQue.push(function(resolve){
      // result object
      app.use(function (req, res, next) {
         res.server = conf;
         res.respond = {};
         res.header("X-powered-by", conf.name);
         next();
      });

      // filter dynamic modules
      app.use(function (req, res, next) {
         var path = req.path.split("/");
         path.shift(); // first slash
         var moduleName = path.shift();
         
         if(moduleName && mountedModuleNames.hasOwnProperty(moduleName) == false){
            console.log("moduleName", moduleName);
            // get app config
            var moduleConfPath = server.root + server.appsRoot + moduleName + "/conf.json";
            util.localJson(moduleConfPath).then(function(moduleConf){
               mountedModuleNames.push(moduleName); 
               app.use("/" + moduleName, function(){
                  console.log("fire", moduleName, moduleConf);
               });
            }, function(err){
               console.error(err);
               res.status(500).send("Unknown: " + moduleName);
            });
         }

         next();
      });

      // reply
      app.use(function (req, res, next) {
         //console.log("check", res.respond);
         if (util.obj.members(res.respond)) {
            req.session.count = req.session.count || 0;
            res.send(
               util.obj.merge({
                  app: util.string.into("$0 v$1", [conf.name, conf.version]),
                  seq: 1 + req.session.count++
               }, res.respond)
            );
         } else next();
      });


      
      // build tool
      //app.use("/*/", build);

      // log errors
      app.use(function (err, req, res, next) {
         console.error(err.stack);
         next(err);
      });

      // client error handler
      app.use(function (err, req, res, next) {
         if (req.xhr) {
            res.status(500).send({error: "Something blew up!"});
         } else {
            next(err);
         }
      });

      // final error handler
      app.use(function errorHandler(err, req, res, next) {
         res.sendStatus(err.status);
      });
      resolve();
   });

   // start express
   mainQue.push(function(resolve){
      server = app.listen(conf.port, conf.domain);
      resolve();
   });

   // mount sockets
   mainQue.push(function(resolve){
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
      });

      resolve();
   });

   module.exports = function(confIn){
      conf = confIn;
      mainQue.then(function(){
         console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
         console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", conf.name, conf.version, conf.domain, conf.port);
         resolve();
      });
   };
}())

