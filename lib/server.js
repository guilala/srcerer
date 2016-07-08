/*!
* Srcerer server
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/

// nodejs
process.on("uncaughtException", (err) => {
   console.error("\x1b[31m%s: \x1b[33m%s", err, err.stack);
});

// require
const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const express = require("express");
const socketServer = require("ws").Server;
const compression = require("compression");
const cookieParser = require("cookie-parser");
const cookieSession = require("cookie-session");
const bodyParser = require("body-parser");
const favicon = require("serve-favicon");

// local
const util = require("./util");
const build = require("./build");
const io = require("./io");
const socket = require("./socket");

// env
const host = os.hostname();
const root = path.dirname(require.main.filename) + "/";

var conf;
var app;
var router;
var runtime = {};

// conditions
const checkConditions = function(done){
   var unmet = [];
   var conditions = {
      serverConfiguration: conf,
      domain: conf.domain,
      port: conf.port,
      root: conf.root,
      name: conf.name,
      version: conf.version,
      cookies: conf.cookies
   };

   for(var key in conditions) {
      if(conditions.hasOwnProperty(key) && !conditions[key]) {
         unmet.push(key);
      }
   }

   if(unmet.length) {
      console.error(`Unmet conditions: ${unmet}`);
   } else {
      done();
   }
};

// configure express
const configureExpress = function(done){
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

   done();
};

// mount app, io and socket modules
const enableMountPoints = function(done){
   // mount table
   conf.mount = {
      app: {},
      io: {},
      socket: {}
   };

   var mount = function(mountPath, target, mountType){
      // mount point equals mountPath directory name
      mountPoint = path.dirname(mountPath).split(path.sep).pop();

      // keep track of conficuration files
      conf.mount[mountType][mountPoint] = mountPath;

      // mount target to point
      router.use("/" + mountPoint, target);
      console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
   };

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
      done();
   });
};

// reply
const enableReply = function(done){
   // reply with json if res.respond is used
   router.use(function (req, res, next) {
      if(util.obj.length(res.respond)){
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

   // reply errors
   router.use(function(err, req, res, next){
      if(err){
         var status = 500;

         console.error(err);
         if (req.xhr) {
            res.send({
               error: status
            });
         } else {
            res.sendStatus(status);
         }
      }

      next();
   });

   done();
};

// export init
module.exports = function(confIn){
   conf = confIn;

   util.que()
   .add(checkConditions)
   .add(configureExpress)
   .add(enableMountPoints)
   .add(enableReply)

   .then(function(){
      // apply routes
      app.use("/", router);

      // start express
      app.listen(conf.port, conf.domain);

      console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
      console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", conf.name, conf.version, conf.domain, conf.port);
   });
};

