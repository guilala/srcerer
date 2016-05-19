/*!
* Srcerer server
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
   var io = require("./io");
   var socket = require("./socket");

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

   // mount app and io modules
   mainQue.push(function(resolve){
      conf.mount = {
         app: {},
         io: {},
         socket: {}
      };
      
      var mount = function(mountPath, target, mountType){
         mountPoint = path.dirname(mountPath).split(path.sep).pop();
         conf.mount[mountType][mountPoint] = mountPath;
         app.use(mountPoint, target);
         console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
      }
      
      fs.walk(conf.root)
      
      .on("data", function (item) {
         var fileName = path.basename(item.path);
         
         if(fileName === "app.json" && conf.mountApps){
            mount(item.path, build, "app");
         }

         else if(fileName === "io.json" && conf.mountIos){
            console.log("aa", io);
            mount(item.path, io, "io");
         }

         else if(fileName === "socket.json" && conf.mountSockets){
            mount(item.path, socket, "socket");
         }
      })

      .on("end", function(){
         resolve();
      })
   });

   // http
   mainQue.push(function(resolve){
      // result object
      app.use(function (req, res, next) {
         res.server = conf;
         res.respond = {};
         res.header("X-powered-by", conf.name);
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
      
      // handle errors
      app.use(function (err, req, res, next) {
         console.error(err.stack);
         
         if (req.xhr) {
            res.status(500).send({error: "Something blew up!"});
         } else {
            res.sendStatus(err.status);
         }
      });

      resolve();
   });
   
   // start express
   mainQue.push(function(resolve){
      server = app.listen(conf.port, conf.domain);
      resolve();
   });

   module.exports = function(confIn){
      conf = confIn;
      mainQue.then(function(){
         console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
         console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", conf.name, conf.version, conf.domain, conf.port);
      });
   };
}())

