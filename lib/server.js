/*!
* Srcerer, server
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

// nodejs
process.on("uncaughtException", (err) => {
   console.error("\x1b[31m%s: \x1b[33m%s", err, err.stack);
});

// require
const os = require("os");
const fs = require("fs-extra");
const path = require("path");
const url = require("url");
const express = require("express");
const ws = require("ws").Server;

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

// conditions
const checkConditions = function(done) {
   var unmet = [];
   var conditions = {
      serverConfiguration: this.conf,
      domain: this.conf.domain,
      port: this.conf.port,
      root: this.conf.root,
      name: this.conf.name,
      version: this.conf.version,
      cookies: this.conf.cookies
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
const configureExpress = function(done) {
   this.server = require("http").createServer();
   this.express = express();
   this.router = express.Router();
   this.static = express.static;

   this.express.disable('x-powered-by');
   this.express.set("env", "production");
   this.express.set("title", this.conf.name);
   this.express.set("version", this.conf.version);
   this.express.set("trust proxy", this.conf.domain); // X-Forwarded-* headers

   this.express.use(compression());
   this.express.use(cookieParser());
   this.express.use(cookieSession(this.conf.cookies));
   this.express.use(bodyParser.json());

   this.express.use(bodyParser.urlencoded({
      extended: true
   }));

   // fav icon
   if(this.conf.favicon) {
      this.express.use(favicon(this.conf.root + this.conf.favicon));
   }

   this.router.use((req, res, next) => {
      req.util = util; // expose utils
      req.runtime = this // this runtime
      res.respond = {}; // json response
      next();
   });

   done();
};

// mount app, io and socket modules
const enableMountPoints = function(done) {
   const mount = (mountPath, handler, mountType) => {
      // mount point equals mountPath directory name
      const mountPoint = path.dirname(mountPath).split(path.sep).pop();

      // keep track of configuration files
      this.mount[mountType][mountPoint] = mountPath;

      // mount handler
      if(mountType !== "socket") {
         this.router.use(
            "/" + mountType + "/" + mountPoint,
            handler
         );
      }

      console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
   };
   
   // find all app, io and socket modules
   fs.walk(this.conf.root)

   .on("data", (item) => {
      var fileName = path.basename(item.path);

      if(fileName === "app.json" && this.conf.mountApps){
         mount(item.path, build, "app");
      }

      else if(fileName === "io.json" && this.conf.mountIos){
         mount(item.path, io, "io");
      }

      else if(fileName === "socket.json" && this.conf.mountSockets){
         mount(item.path, socket, "socket");
      }
   })

   .on("end", function(){
      done();
   });
};

// route socket requests
const routeSockets = function(done) {
   if(this.conf.mountSockets) {
      // web socket server
      this.wss = new ws({
         server: this.server
      });

      // web socket connections
      this.wss.on("connection", (ws) => {
         if(ws.protocol){
            socket(ws, this);
         }
      });
   }

   done();
};

// reply
const jsonReply = function(done) {
   // reply with json if res.respond has keys
   this.router.use((req, res, next) => {
      if(util.obj.keyCount(res.respond)){
         // parse response
         req.session.count = req.session.count || 0;
         res.send(
            util.obj.merge({
               io: `${this.conf.name} ${this.conf.version}`,
               req: req.session.count++
            }, res.respond)
         );
      } else {
         next();
      }
   });

   // reply errors
   this.router.use(function(err, req, res, next){
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
module.exports = function(configuration) {
   util.que({
      conf: configuration,
      express: undefined,
      static: undefined,
      router: undefined,
      mount: {
         app: {},
         io: {},
         socket: {}
      },
      apps: {}
   })

   .add(checkConditions)
   .add(configureExpress)
   .add(enableMountPoints)
   .add(routeSockets)
   .add(jsonReply)

   .then(function(){
      // apply routes
      this.express.use("/", this.router);

      // start express
      
      this.server.on("request", this.express);
      this.server.listen(this.conf.port, this.conf.domain, () => {
         var serverInstance = this.server.address();

         console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s",
            new Date(),
            process.version,
            host
         );

         console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s on %s\x1b[0m\n",
            this.conf.name,
            this.conf.version,
            serverInstance.address,
            serverInstance.port,
            serverInstance.family
         );
      });
   });
};

