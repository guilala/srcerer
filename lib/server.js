/*!
* Srcerer server
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/

(function(){
   // nodejs
   process.on("uncaughtException", function (err) {
      console.error("\x1b[31mUncaught \x1b[33m%s", err);
   });

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
   var favicon = require("serve-favicon");

   // local
   var util = require("./util");
   var build = require("./build");
   var io = require("./io");
   var socket = require("./socket");

   // env
   var conf, app, router;
   var host = os.hostname();
   var root = path.dirname(require.main.filename) + "/";
   var runtime = {};
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
      router = express.Router();

      app.disable('x-powered-by');
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

      if(conf.favicon) app.use(favicon(conf.root + conf.favicon));

      router.use(function (req, res, next) {
         req.server = conf; // module access to configurations
         req.runtime = runtime; // runtime global
         res.respond = {}; // json response
         next();
      });

      resolve();
   });

   // mount app, io and socket modules
   mainQue.push(function(resolve){
      var mount = function(mountPath, target, mountType){
         // mount point equals mountPath directory name
         mountPoint = path.dirname(mountPath).split(path.sep).pop();

         // keep track of conficuration files
         conf.mount[mountType][mountPoint] = mountPath;

         // mount target to point
         router.use("/" + mountPoint, target);
         console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
      }

      // find all app, io and socket modules
      fs.walk(conf.root)

      .on("data", function (item) {
         var fileName = path.basename(item.path);

         if(fileName === "app.json" && conf.mountApps){
            mount(item.path, build, "app");
         }

         else if(fileName === "io.json" && conf.mountIos){
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

   // reply
   mainQue.push(function(resolve){
      router.use(function (req, res, next) {
         if(res.respond){
            // parse response
            req.session.count = req.session.count || 0;
            res.send(
               util.obj.merge({
                  app: `${conf.name} ${conf.version}`,
                  req: req.session.count++
               }, res.respond)
            );
         } else {
            next();
         }
      });

      // error handling
      router.use(function(err, req, res, next){
         var status = 404;
         if (req.xhr) {
            res.send({
               error: status
            });
         } else {
            res.sendStatus(status);
         }
         next();
      });

      resolve();
   });

   // export init
   module.exports = function(confIn){
      conf = confIn;

      // mount table
      conf.mount = {
         app: {},
         io: {},
         socket: {}
      }

      mainQue.then(function(){
         // apply routes
         app.use("/", router);

         // start express
         app.listen(conf.port, conf.domain);

         console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
         console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", conf.name, conf.version, conf.domain, conf.port);
      });
   };
}())

