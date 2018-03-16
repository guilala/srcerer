/*!
* Srcerer, server
* Copyright(c) 2010-2017 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

// nodejs
process.on("uncaughtException", (err) => {
   console.error("%s: %s", err, err.stack);
});

// require
const os = require("os");
const path = require("path");
const url = require("url");
const express = require("express");
const ws = require("ws").Server;
const compression = require("compression");
const bodyParser = require("body-parser");
const healthcheck = require("express-healthcheck");

// local
const util = require("./util");
const mountPoints = require("./mountPoints");

// env
const host = os.hostname();
const root = path.dirname(require.main.filename) + "/";

// package
const getPackage = function(done) {
   util.localJson(path.join(
      this.conf.srcererRoot,
      "package.json"
   )).then((packageData) => {
      this.conf.packageData = packageData;
      this.conf.version = this.conf.version || packageData.version;
      done();
   });
};

// conditions
const checkConditions = function(done) {
   var unmet = [];

   var conditions = {
      serverConfiguration: this.conf,
      domain: this.conf.domain,
      port: this.conf.port,
      root: this.conf.root,
      name: this.conf.name,
      version: this.conf.version
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
   this.express.use(bodyParser.json());
   this.express.use("/healthcheck", healthcheck());

   this.express.use(bodyParser.urlencoded({
      extended: true
   }));

   this.router.use((req, res, next) => {
      res.respond = {}; // json response
      req.runtime = this; // this runtime
      next();
   });

   done();
};

// route socket requests
const routeSockets = function(done) {
   // web socket server
   this.wss = new ws({
      server: this.server
   });

   // web socket connections
   this.wss.on("connection", (ws) => {
      if(ws.protocol) {
         const context = this.mount.socket[ws.protocol];

         if(context && context.root) {
            require(
               path.resolve(
                  context.root,
                  context.configuration.script
               )
            ).call({
               context: context,
               mountPoint: ws.protocol,
               runtime: this,
               ws: ws
            });
         } else {
            console.error("server, routeSockets: unknown protocol:", ws.protocol);
            ws.terminate();
         }
      } else {
         console.error("server, routeSockets: protocol undefined.");
         ws.terminate();
      }
   });

   done();
};

// reply
const reply = function(done) {
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
      } else {
         next();
      }
   });

   done();
};

// export init
module.exports = function(configuration) {
   util.que({
      conf: configuration,
      mount: {
         app: {},
         extention: {},
         io: {},
         socket: {}
      },
      apps: {}
   })

   .add(getPackage)
   .add(checkConditions)
   .add(configureExpress)
   .add(mountPoints)
   .add(routeSockets)
   .add(reply)

   .then(function(){
      // apply routes
      this.express.use("/", this.router);

      // start express
      this.server.on("request", this.express);
      this.server.listen(this.conf.port, this.conf.domain, () => {
         const serverInstance = this.server.address();
         const deps = this.conf.packageData.dependencies;
         console.log("\n%s\nExpress: %s, WS: %s\nSrcerer v%s @ Node %s @ %s\n%s @ %s:%s on %s\n",
            new Date(),
            deps.express,
            deps.ws,
            this.conf.version,
            process.version,
            host,
            this.conf.name,
            serverInstance.address,
            serverInstance.port,
            serverInstance.family
         );
      });
   });
};

