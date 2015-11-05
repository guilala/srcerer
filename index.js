/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

module.exports = function () {
  // require
  var os = require("os");
  var express = require("express");
  var socketServer = require("ws").Server;
  var compression = require("compression");
  var cookieParser = require("cookie-parser");
  var cookieSession = require("cookie-session");
  var bodyParser = require("body-parser");
  var db = require("mongoose");

  // local
  var util = require("./lib/util");
  var build = require("./lib/build");

  // env
  var conf;
  var app;
  var server;
  var host = os.hostname();
  var mainQue = new util.Que(this);

  // version info
  mainQue.push(function(resolve){
    var npm = require(conf.npm);
    npm.load(function(err, npm) {
      npm.commands.ls([], true, function(err, data) {
        var dep = data.dependencies;
        for(var pkg in dep){
          console.log("\x1b[35m%s\x1b[36m %s %s", pkg, dep[pkg].version, dep[pkg].invalid ? "\x1b[31minvalid" : "\x1b[32mvalid");
        }
        console.log("");
        resolve();
      });
    });
  });

  // conditions
  mainQue.push(function(resolve){
    if(
      conf &&
      conf.url
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
      } else console.error("DB not set for", host);
    } else console.error("DB settings missing");
  });

  // configure express
  mainQue.push(function(resolve){
    app = express();
    app.set("env", "production");
    app.set("title", conf.name);
    app.set("version", conf.version);
    app.set("trust proxy", "127.0.0.1"); // X-Forwarded-* headers
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
        console.log("\x1b[35mRequire module\x1b[36m %s \x1b[0m%s", m.mount.substring(1), m.path);
        app.use(m.mount, require(m.path));
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
    server = app.listen(conf.port, conf.url);
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

  // default
  this.name = "Srcerer";
  this.version = "0.6.0";
  this.port = 2000;
  this.url = "127.0.0.1";
  this.npm = "/usr/local/lib/node_modules/npm";
  this.mount = "/srcerer/";
  this.app = "app/";
  this.db = {
    "pxl": "mongodb://localhost/sorcerer",
    "guila.la": "mongodb://localhost/sorcerer",
    "rmb.local": "mongodb://localhost/sorcerer",
    "sleepy": "mongodb://localhost/sorcerer",
    "duoMe": "mongodb://localhost/sorcerer"
  };
  this.modules = [
    {
      "host": "*",
      "path": "./share/blob/visit/module/visit.js",
      "mount": "/visit"
    },
    {
      "host": "*",
      "path": "./share/blob/visit/module/log.js",
      "mount": "/log"
    },
    {
      "host": "*",
      "path": "./share/blob/upload/module/receive.js",
      "mount": "/upload"
    }
  ];
  this.sockets = [
    {
      "host": "*",
      "mount": "kettle",
      "path": "./app/button/blob/kettle/socket.js"
    }, {
      "host": "*",
      "mount": "clerk",
      "path": "./app/clerk/blob/main/socket.js"
    }
  ];

  this.start = function(directConf){
    conf = directConf || conf;
    mainQue.then(function(){
      console.log("\n\x1b[0m%s\nNode %s\x1b[36m @ %s", new Date(), process.version, host);
      console.log("\x1b[35m%s v%s\x1b[36m @ %s:%s\x1b[0m\n", conf.name, conf.version, conf.url, conf.port);
      resolve();
    });
  }

  conf = this;
};
