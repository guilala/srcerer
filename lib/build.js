/*!
* Srcerer build tool
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/

var fs = require("fs-extra");
var path = require("path");
var ugly = require("uglify-js");
var less = require("less");
var svgo = require("svgo");
var util = require("./util");

var getBuildName = function(next) {
   this.path = this.path.filter(String);
   this.build = this.path.shift();
   this.session.build = this.build;
   next();
};

var loadApplicationConfiguration = function(next) {
   var appConfFileName = "app.json";

   this.appRoot = path.join(
      this.server.root,
      this.server.appsRoot,
      this.build + "/"
   );

   util.localJson(this.appRoot + appConfFileName).then((confData) => {
      this.appConf = confData;
      next();
   }, () => {
      console.error("loadApplicationConfiguration", confPath);
      this.res.status(500).send("Unknown: " + this,build);
   });
};

var serveStatic = function(next){
   // set static root
   this.staticRoot = path.join (
      this.appRoot,
      this.appConf.staticRoot
   );

   // serve if static file
   if (this.path[0]) {
      this.res.sendFile(this.path.join("/"), {
         root: this.staticRoot
      });
   } else {
      next();
   }
};

var confLess = function(next) {
   this.lessConfig = {
      paths: (() => {
         var lessImportPaths = [];
         this.appConf.stylePaths.forEach((stylePath) => {
            lessImportPaths.push(path.join(this.appRoot + stylePath));
         });
         return lessImportPaths;
      })(), // paths for @import directives
      filename: "Cannot parse less", // for error messages
      compress: true // !debug
   };
   next();
};

// ensure root for static files
var staticRoot = function(next){
   var exists;
   new util.que(this)

   .add((next) => {
      fs.exists(this.staticRoot, function(existing){
         exists = existing;
         next();
      });
   })

   .then(() => {
      if (exists){
         next();
      } else {
         console.log("'%s', new path '%s'", this.appConf.name, this.staticRoot);
         fs.mkdir(this.staticRoot, "0775", () => {
            next();
         });
      }
   });
};

var addBlob = function(blobName, blobPath, done) {
   var pathPrefix = path.join(
      blobPath,
      blobName,
      "/",
      blobName
   );

   var blob = {
      name: blobName,
      path: blobPath,
      blobRoot: this.blobRoot,
      lessConfig: this.lessConfig,
      debug: this.debug,

      mvcFile: pathPrefix + ".js",
      mvcModified: undefined,

      cssFile: pathPrefix + ".less",
      cssModified: undefined,

      svgFile: pathPrefix + ".svg",
      svgModified: undefined
   };

   util.all()

   // is mvc modified
   .add((done) => {
      util.modified(blob.mvcFile, blobName + "Mvc").then((state) => {
         blob.mvcModified = state;
         done();
      }, (err) => {
         blob.mvcModified = false;
         done();
      });
   })

   // is css modified
   .add((done) => {
      util.modified(blob.cssFile, blobName + "Css").then((state) => {
         blob.cssModified = state;
         done();
      }, (err) => {
         blob.cssModified = false;
         done();
      });
   })

   // is svg modified
   .add((done) => {
      util.modified(blob.svgFile, blobName + "Svg").then((state) => {
         blob.svgModified = state;
         done();
      }, (err) => {
         blob.svgModified = false;
         done();
      });
   })

   // is blob modified
   .then(() => {
      if(blob.mvcModified || blob.cssModified || blob.svgModified) {
         this.blobs.push(blob);
      }
      done();
   });
};

// find and configure all blobs
var blobsConfigure = function(next) {
   // define static root for blobs
   this.blobRoot = path.join(
      this.staticRoot,
      "bin/"
   );
   
   // get all blobs
   var configureBlobs = util.all(this);
   this.appConf.blobPaths.forEach((blobPath) => {
      blobPath = path.join(
         this.appRoot,
         blobPath
      );

      // direct child directories are blob sources
      util.dir.getDirectories(blobPath).forEach((blobName) => {
         configureBlobs.add((done) => {
            addBlob.call(this, blobName, blobPath, done);
         });
      });
   });

   // async configure all blobs
   configureBlobs.then(next);
};

// ensure root directory for blob bin files
var blobsStaticRoot = function(next){
   var exists;

   new util.que(this)

   .add((next) => {
      fs.exists(this.blobRoot, function(existing){
         exists = existing;
         next();
      });
   })

   .then(() => {
      if (exists){
         next();
      } else {
         console.log("'%s', new path '%s'", this.appConf.name, this.blobRoot);
         fs.mkdir(this.blobRoot, "0775", () => {
            next();
         });
      }
   });
};

var blobCss = function(done) {
   fs.readFile(this.cssFile, "utf8", (err, data) => {
      if (err) {
         console.error("Blob, style sheet not found", cssFile);
         done();
      } else {
         less.render(data, this.lessConfig, (lessErr, cssResult) => {
            if (!lessErr) {
               this.css = cssResult.css;
               // console.log("Got css", css);
            } else {
               console.log(lessErr);
            }
            done();
         });
      }
   });
};

var blobSvg = function(done) {
   fs.readFile(this.svgFile, "utf8", (err, data) => {
      if (err) {
         console.error("Blob, svg not found", svgFile);
         done();
      } else {
         new svgo({
            full: true,
            plugins: [
               {
                  removeViewBox: false,
                  cleanupIDs: false,
                  moveElemsAttrsToGroup: false,
                  moveGroupAttrsToElems: false,
                  collapseGroups: false,
                  convertPathData: false,
                  convertTransform: false,
                  mergePaths: false
               }
            ]
         }).optimize(data, (result) => {
            this.svg = result.data;
            // console.log("Got svg", svg);
            done();
         });
      }
   });
};

var blobMvc = function(done) {
   fs.readFile(this.mvcFile, "utf8", (err, data) => {
      if(err) {
         console.error("Blob, mvc not found", mvcFile);
         done();
      } else {
         if (!this.debug) {
            this.mvc = ugly.minify(data, {
               fromString: true,
               mangle: true
            }).code.slice(1).slice(0, -3) + "()"; // replace !() with ()()
         } else {
            this.mvc = data;
         }
      }
      done();
   });
};

var blobExport = function(done) {
   var blob = '({\nb:"' + this.name + '"';

   if (this.css) {
      blob += ',\ns:"' + this.css.replace(/"/g, '\\"') + '"';
   }

   if (this.svg) {
      blob += ',\ni:"' + this.svg.replace(/"/g, '\\"') + '"';
   }

   if (this.mvc) {
      blob += ',\nm:' + this.mvc;
   }

   blob += "\n})";

   // debugger source mapping
   if(this.debug){
      blob = "//# sourceURL=" + this.name + "\n" + blob;
   }

   fs.writeFile(this.blobRoot + this.name + ".js", blob, "utf8", done);
};

var blobsCompile = function(next) {
   var logTime = (t) => { return t ? new Date(t).toString() : "unchanged";};
   var compiling = util.all();

   this.blobs.forEach((blob) => {
      compiling.add((done) => {
         var parts = util.all(blob);

         console.log("'%s' blob \x1b[36m%s\x1b[0m", this.appConf.name, blob.name);

         if(blob.cssModified) {
            console.log("\x1b[34m\tCSS %s\x1b[0m", logTime(blob.cssModified));
            parts.add(blobCss);
         }
         if(blob.svgModified) {
            console.log("\x1b[32m\tSVG %s\x1b[0m", logTime(blob.svgModified));
            parts.add(blobSvg);
         }
         if(blob.mvcModified) {
            console.log("\x1b[33m\tMVC %s\x1b[0m", logTime(blob.mvcModified));
            parts.add(blobMvc);
         }

         parts.then(() => {
            blobExport.call(blob, done);
         });
      });
   });
   compiling.then(next);
};

var parseIndexHtml = function (done) {
   // parse index.html
   mainQue.push(function (mainResolve) {
      var dom = new util.dombo();
      var into = util.string.into;
      var style = "\n";

      // app name
      dom.comment( into( "$0 v$1: $2 v$3 $4", [
         req.app.get("title"),
         req.app.get("version"),
         app.name,
         app.version,
         new Date()
      ]));

      app.meta.forEach(function (m) {
         dom.head("meta", "", m);
      });

      dom.head("title", app.name);

      // combine less files
      app.style.forEach(function (s) {
         try {
            style += into("$0\n", [fs.readFileSync(app.root + s, "utf8")]);
         } catch(e) {
            console.error(e);
         }
      });

      // parse combined less files
      less.render(style, lessConfig, function (lessParseError, cssResult) {
         // don't crash on less parser errors
         if (lessParseError) {
            console.log("LESS parser error", lessParseError);
            res.respond = "LESS parser error: " + JSON.stringify(lessParseError);
            next();
            return;
         }

         dom.style(cssResult.css);

         // external scripts
         if (app.ext) app.ext.forEach(function (ext) {
            dom.head("script", "", ext);
         });

         // bubbles.js is mandatory first inline script
         var libs = [{
            name: "bubbles.js",
            path: __dirname + "/bubbles.js"
         }];

         // attach more lib files to app root
         if(app.lib && app.lib.length) app.lib.forEach(function(lib){
            libs.push({
               name: lib,
               path: app.root + lib
            });
         });

         // individual inline scripts
         libs.forEach(function (lib) {
            try {
               var libTxt = fs.readFileSync(lib.path, "utf8");
               // console.log("inline script", file);
               if (debug) {
                  dom.script(libTxt);
               } else {
                  var src = ugly.minify(libTxt, {fromString: true, mangle: true}).code;
                  dom.script("/* " + lib.name + " */ " + src);
               }
            } catch(e) {
               console.error(e);
            }
         });

         // app
         var script = "";
         if (app.app) app.app.forEach(function (collect) {
            var collection = "";
            collect.files.forEach(function (file) {
               try {
                  var part = fs.readFileSync(server.root + collect.path + file, "utf8");
                  collection += into("// $0\n$1\n", [file, part]);
               } catch(e) {
                  console.error(e);
               }
            });

            // script minify
            if ((!debug) && collect.minify !== false) {
               collection = ugly.minify(collection, {fromString: true, mangle: true}).code + "\n";
            }

            // concatenate script
            if (debug) {
               script += into("// $0\n$1\n", [collect.path, collection]);
            } else {
               script += collection;
            }
         });

         // insert script
         dom.script(script);

         // body
         if (app.body) app.body.forEach(function (attr) {
            dom.doc.body.setAttribute(attr.name, attr.value);
         });

         // html node
         if (app.html) app.html.forEach(function (attr) {
            dom.doc.getElementsByTagName("html")[0].setAttribute(attr.name, attr.value);
         });

         // result
         var result = dom.parse();

         // send result
         res.send(result);

         // resolve build
         mainResolve();

         // deploy result
         if (app.index) fs.writeFile(app.root + app.static + app.index, result, "utf8");
      });
   });
};

// generate nginx conf
var confNginx = function(next){
   if(this.appConf.nginx && this.appConf.nginx != this.server.runtime.lastConfNginx){
      console.log("creating nginx conf");
      this.server.runtime.lastConfNginx = this.appConf.nginx;
      var tpl = "";

      util.que(this)

      .add((resolve) => {
         fs.readFile(app.nginx.template, "utf8", function (err, data) {
            if (err) console.error("confNginx", err);
            else {
               tpl = data;
               resolve();
            }
         });
      })

      .add((resolve) => {
         fs.ensureFile(app.nginx.file, function (err) {
            if(err) console.error("confNginx", err);
            else resolve();
         });
      })

      .then(() => {
         tpl = tpl
            .replace("<<title>>", app.name + " " + app.version)
            .replace("<<domains>>", app.nginx.domains)
            .replace("<<errors>>", app.nginx.errors)
            .replace("<<srcerer>>", app.nginx.srcerer)
            .replace("<<app>>", app.nginx.root)
            .replace("<<crt>>", app.nginx.crt)
            .replace("<<key>>", app.nginx.key);

         fs.writeFile(app.nginx.file, tpl, "utf8", function(err){
            if(err) console.error("confNginx", err);
         });
      });
   } else next();
};

// export build
module.exports = function (req, res, exit) {
   util.que({
      server: req.server,
      session: req.session,
      res: res,
      path: req.originalUrl.split(path.sep),
      build: undefined,
      appConf: undefined,
      blobs: [],
      previousDebugMode: false
   })

   .add(getBuildName)
   .add(loadApplicationConfiguration)
   .add(serveStatic)
   .add(confLess)
   // .push(confNginx)
   .add(staticRoot)
   .add(blobsConfigure)
   .add(blobsStaticRoot)
   .add(blobsCompile)
   .then(() => {
      console.log("exit build");
      exit();
   });
};

