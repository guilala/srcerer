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
   var db = require("mongoose");

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

   // conditions
   mainQue.push(function(resolve){
      if(
         conf &&
         conf.domain
      ) resolve();
      else console.error("Conditions not met");
   });

   // db connection
   mainQue.push(function(resolve){
      if(conf.db){
         if(conf.db.hasOwnProperty(host)){
            console.log("\x1b[35mdb\x1b[36m %s\n", conf.db[host]);
            db.connect(conf.db[host], {
               server: { poolSize: 4 }
            }, function(err){
               if(err) {
                  console.error("Mongoose", err);
               } else {
                  resolve();
               }
            });
         } else {
            // continue without db
            resolve();
         }
      } else console.error("DB settings missing");
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
      app.use(cookieSession({
         name: "guila.la",
         keys: ["Deesum", "Jaspaat"],
         secret: "Mayday, mayday!!%@#&$..",
         cookie: {path: "/", httpOnly: false, maxAge: 3600000}
      }));
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

      // modules
      conf.modules.forEach(function (m) {
         if (m.host === "*" || m.host.indexOf(host) >= 0) {
            var modulePath = root + m.path;
            if(fs.existsSync(modulePath)){
               console.log("\x1b[35mRequire module\x1b[36m %s \x1b[0m%s", m.mount.substring(1), modulePath);
               app.use(m.mount, require(modulePath));
            } else console.log("Cannot find %s", modulePath);
         } else console.log("no", m);
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
      app.use("/", build);

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
         res.status(500).send(err.status);
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
            console.log("\x1b[35mRequire socket module\x1b[0m '%s'", m.mount, m.path);
            socketModules[m.mount] = require(m.path);
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
