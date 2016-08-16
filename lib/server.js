/*!
* Srcerer, server
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
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

var runtime = {
   conf: undefined,
   express: undefined,
   static: undefined,
   router: undefined,
   mount: {
      app: {},
      io: {},
      socket: {}
   },
   apps: {}
};

// conditions
const checkConditions = function(done){
   var unmet = [];
   var conditions = {
      serverConfiguration: runtime.conf,
      domain: runtime.conf.domain,
      port: runtime.conf.port,
      root: runtime.conf.root,
      name: runtime.conf.name,
      version: runtime.conf.version,
      cookies: runtime.conf.cookies
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
   runtime.express = express();
   runtime.router = express.Router();
   runtime.static = express.static;

   runtime.express.disable('x-powered-by');
   runtime.express.set("env", "production");
   runtime.express.set("title", runtime.conf.name);
   runtime.express.set("version", runtime.conf.version);
   runtime.express.set("trust proxy", runtime.conf.domain); // X-Forwarded-* headers

   runtime.express.use(compression());
   runtime.express.use(cookieParser());
   runtime.express.use(cookieSession(runtime.conf.cookies));
   runtime.express.use(bodyParser.json());
   runtime.express.use(bodyParser.urlencoded({
      extended: true
   }));

   if(runtime.conf.favicon) runtime.express.use(favicon(runtime.conf.root + runtime.conf.favicon));

   runtime.router.use(function (req, res, next) {
      req.server = runtime.conf; // module access to configurations
      req.runtime = runtime; // runtime global
      res.respond = {}; // json response
      next();
   });

   done();
};

// mount app, io and socket modules
const enableMountPoints = function(done){
   var mount = function(mountPath, target, mountType){
      // mount point equals mountPath directory name
      mountPoint = path.dirname(mountPath).split(path.sep).pop();

      // keep track of configuration files
      runtime.mount[mountType][mountPoint] = mountPath;

      // mount target to point
      runtime.router.use("/" + mountType + "/" + mountPoint, target);
      console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
   };

   // find all app, io and socket modules
   fs.walk(runtime.conf.root)

   .on("data", function (item) {
      var fileName = path.basename(item.path);

      if(fileName === "app.json" && runtime.conf.mountApps){
         mount(item.path, build, "app");
      }

      else if(fileName === "io.json" && runtime.conf.mountIos){
         mount(item.path, io, "io");
      }

      else if(fileName === "socket.json" && runtime.conf.mountSockets){
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
   runtime.router.use(function (req, res, next) {
      if(util.obj.length(res.respond)){
         // parse response
         req.session.count = req.session.count || 0;
         res.send(
            util.obj.merge({
               app: `${runtime.conf.name} ${runtime.conf.version}`,
               req: req.session.count++
            }, res.respond)
         );
      } else {
         next();
      }
   });

   // reply errors
   runtime.router.use(function(err, req, res, next){
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
   runtime.conf = confIn;

   util.que()
   .add(checkConditions)
   .add(configureExpress)
   .add(enableMountPoints)
   .add(enableReply)

   .then(function(){
      // apply routes
      runtime.express.use("/", runtime.router);

      // start express
      runtime.express.listen(runtime.conf.port, runtime.conf.domain);

      console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
      console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", runtime.conf.name, runtime.conf.version, runtime.conf.domain, runtime.conf.port);
   });
};

