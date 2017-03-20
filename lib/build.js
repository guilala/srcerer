/*!
* Srcerer, build tool
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const ugly = require("uglify-js");
const less = require("less");
const svgo = require("svgo");
const util = require("./util");

const getBuildName = function(next) {
   var basePath = this.urlBase.split(path.sep);
   if(basePath.length) {
      this.build = basePath.pop();

      // create runtime object for app
      if(!this.runtime.apps.hasOwnProperty(this.build)) this.runtime.apps[this.build] = {};

      next();
   } else {
      console.error("getBuildName: build name unknown");
      this.res.status(500).send("Build name unknown");
   }
};

const loadApplicationConfiguration = function(next) {
   this.appRoot = path.join(
      this.runtime.conf.root,
      this.runtime.conf.appsRoot,
      this.build + "/"
   );

   var appConfFile = this.appRoot + "app.json";

   // check if modified
   util.modified(appConfFile, this.build).then((modified) => {
      if(modified) {
         util.localJson(appConfFile).then((confData) => {
            this.appConf = confData;
            this.appConf.modified = modified;
            this.runtime.apps[this.build].appConf = this.appConf;
            next();
         }, () => {
            console.error("loadApplicationConfiguration", appConfFile);
            this.res.status(500).send("Error: " + this.build);
         });
      }

      else {
         this.appConf = this.runtime.apps[this.build].appConf;
         this.appConf.modified = false;
         next();
      }
   }, (err) => {
      console.error("loadApplicationConfiguration", err);
      this.res.status(500).send("Error: " + this.build);
   });
};

const setStaticRoot = function(next){
   if(this.appConf.staticRoot && this.appConf.staticRoot.constructor === String) {

      // set static root
      this.staticRoot = path.join (
         this.appRoot,
         this.appConf.staticRoot
      );

      next();
   } else {
      console.error("serveStatic, String expected: appConf.staticRoot");
      this.res.status(500).send("Expected staticRoot");
   }
};

// ensure root for static files
const makeStaticRoot = function(next){
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

const serveStaticRoot = function(next) {
   // start serving static
   if(!this.runtime.apps[this.build].hasOwnProperty("serveStatic")) {
      this.runtime.router.use(this.urlBase, this.runtime.static(this.staticRoot));
      this.runtime.apps[this.build].serveStatic = true;
   }

   // exit build if request is not index.html
   if(this.urlPath.length > 1 && this.urlPath != "/index.html") {
      this.exit();
   }

   // build index.html
   else {
      next();
   }
};

const controlCache = function(next) {
   if (this.runtime.lastDebugMode !== this.debug) {
      util.clearModificationCache();
      this.runtime.lastDebugMode = this.debug;
      this.appConf.modified = true;
   }
   next();
};

const confLess = function(next) {
   // paths for @import
   this.lessConfig = {
      paths: (() => {
         var lessImportPaths = [];
         this.appConf.stylePaths.forEach((stylePath) => {
            lessImportPaths.push(path.join(this.appRoot + stylePath));
         });
         return lessImportPaths;
      })(),
      filename: "Cannot parse less", // for error messages
      compress: true
   };
   next();
};

const addBlob = function(blobName, blobPath, done) {
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

   new util.all()

   // is mvc modified
   .add((done) => {
      util.modified(blob.mvcFile, blobName + "Mvc").then((state) => {
         blob.mvcModified = state;
         blob.mvc = true;
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
         blob.css = true;
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
         blob.svg = true;
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
const blobsConfigure = function(next) {
   // define static root for blobs
   this.blobRoot = path.join(
      this.staticRoot,
      "bin/"
   );

   // async configure all blobs
   var configureBlobs = new util.all(this);

   if(util.obj.isArray(this.appConf.blobs)) {
      this.appConf.blobs.forEach((blobNode) => {
         var blobList;

         // parse path to blob node
         const blobPath = util.parsePaths([
            this.appRoot,
            blobNode.path
         ]);

         if(blobNode.select) {
            // select is a list of blob src child directories
            blobList = util.obj.arrayify(blobNode.select);
         } else {
            // else any child directory is a blob src
            blobList = util.dir.getDirectories(blobPath);
         }

         blobList.forEach((blobName) => {
            var myPath = blobPath;
            configureBlobs.add((done) => {
               addBlob.call(this, blobName, myPath, done);
            });
         });
      });
   }

   configureBlobs.then(next);
};

// ensure root directory for blob bin files
const blobsStaticRoot = function(next){
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

const blobCss = function(done) {
   fs.readFile(this.cssFile, "utf8", (err, data) => {
      if (err) {
         console.error("Blob, style sheet not found", this.cssFile);
         done();
      } else {
         less.render(data, this.lessConfig, (lessErr, cssResult) => {
            if (lessErr) {
               console.error(lessErr);
            } else {
               this.css = cssResult.css;
            }
            done();
         });
      }
   });
};

// blob compile svg
const blobSvg = function(done) {
   fs.readFile(this.svgFile, "utf8", (err, data) => {
      if (err) {
         console.error("Blob, svg not found", this.svgFile);
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
            done();
         });
      }
   });
};

// blob compile mvc
const blobMvc = function(done) {
   var blob = this;

   fs.readFile(this.mvcFile, "utf8", (err, data) => {
      if(err) {
         console.error("Blob, mvc not found", this.mvcFile);
         done();
      } else {
         // shim bubbleSet
         data = `bubbleSet.${this.name}(function(){\nthis.css = ${!!blob.css};\n${data}});`;

         // debug source map
         if(this.debug){
            data = "//# sourceURL=" + this.name + "\n" + data;
         }

         else {
            data = ugly.minify(data, {
               fromString: true,
               mangle: true
            }).code;
         }

         this.mvc = data;
      }
      done();
   });
};

// blob write to disk
const blobExport = function(done) {
   const writeFiles = new util.all(this);

   if(this.css) {
      writeFiles.add(function(ready){
         fs.writeFile(this.blobRoot + this.name + ".css", this.css, "utf8", (err) => {
            assert.equal(err);
            ready();
         });
      });
   }

   if(this.svg) {
      writeFiles.add(function(ready){
         fs.writeFile(this.blobRoot + this.name + ".svg", this.svg, "utf8", (err) => {
            assert.equal(err);
            ready();
         });
      });
   }

   if(this.mvc) {
      writeFiles.add(function(ready){
         fs.writeFile(this.blobRoot + this.name + ".js", this.mvc, "utf8", (err) => {
            assert.equal(err);
            ready();
         });
      });
   }

   writeFiles.then(done);
};

// compile changed blobs simultaneously
const blobsCompile = function(next) {
   var logTime = (t) => { return t ? new Date(t).toString() : "unchanged";};
   var compiling = new util.all();

   this.blobs.forEach((blob) => {
      compiling.add((done) => {
         var parts = new util.all(blob);

         console.log("'%s' blob \x1b[36m%s\x1b[0m", this.appConf.name, blob.name);

         if(blob.css) {
            console.log("\x1b[34m\tCSS %s\x1b[0m", logTime(blob.cssModified));
            parts.add(blobCss);
         }

         if(blob.svg) {
            console.log("\x1b[32m\tSVG %s\x1b[0m", logTime(blob.svgModified));
            parts.add(blobSvg);
         }

         if(blob.mvc) {
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

// compile stylesheet for index.html
const indexInlineCss = function (next) {
   if(this.appConf.modified && this.appConf.inlineCss) {
      // combine less files
      var lessSource = [];

      var index = 0;
      var loadLessFiles = new util.all();
      this.appConf.inlineCss.forEach((file) => {
         loadLessFiles.add((done) => {
            var myIndex = index;
            index ++;
            fs.readFile(this.appRoot + file, "utf8", (err, data) => {
               if(err) {
                  console.error(`indexInlineCss, file not found: ${ this.appRoot + file }`);
               } else {
                  lessSource[myIndex] = data + "\n";
               }
               done();
            });
         });
      });

      loadLessFiles.then(() => {
         // parse combined less source
         less.render(lessSource.join(""), this.lessConfig, (err, result) => {
            if (err) {
               console.error(`indexInlineCss, less.render: ${
                  err
               }`);
            } else {
               this.indexInlineCss = result.css;
            }
            next();
         });
      });
   } else {
      next();
   }
};

const parseBubbles = function(ready) {
   if(this.appConf.modified) {
      var pathBubbles = __dirname + "/bubbles.js";
      fs.readFile(pathBubbles, "utf8", (err, data) => {
         if(err) {
            console.error(`bubbles.js, fs.readFile: ${
               err
            }`);
            ready();
         } else {
            // minify if not in debug mode
            if(!this.debug) {
               data = ugly.minify(data, {
                  fromString: true,
                  mangle: true
               }).code;
            }

            var filePath = path.join(
               this.blobRoot,
               "bubbles.js"
            );

            fs.writeFile(filePath, data, "utf8", (err) => {
               assert.equal(err);
               ready();
            });
         }
      });
   } else {
      ready();
   }
};

// parse index.html and write to disk
const indexWrite = function (next) {
   if(this.appConf.modified) {
      var dom = new util.dombo();

      // name comment
      dom.comment(`${
         this.appConf.name || "app"
      } v${
         this.appConf.version || 0
      }: ${
         this.runtime.conf.name || "server"
      } v${
         this.runtime.conf.version || 0
      } ${
         new Date()
      }`);

      // meta tags
      if(this.appConf.meta && this.appConf.meta.length) {
         this.appConf.meta.forEach(function (meta) {
            dom.head("meta", false, meta);
         });
      }

      // custom header tags
      if(this.appConf.tag && this.appConf.tag.length) {
         this.appConf.tag.forEach(function (tag) {
            dom.head(tag.name, false, tag.attr);
         });
      }

      // don't cache in debug mode
      if(this.debug) {
         dom.head("meta", false, {
            "http-equiv": "cache-control",
            "content": "no-cache"
         });
      }

      // title
      dom.head("title", this.appConf.name || "app");

      var scriptTags = [{
         src: "bin/bubbles.js",
         type: "text/javascript",
         charset: "utf-8",
         async: undefined
      }];

      if(util.obj.isArray(this.appConf.externalScripts)) {
         scriptTags = scriptTags.concat(this.appConf.externalScripts);
      }

      // script source tags
      scriptTags.forEach((src) => {
         dom.head("script", "", src);
      });

      // write index to disk
      if (this.appConf.index) {
         fs.writeFile(this.staticRoot + this.appConf.index, dom.parse(), "utf8", (err) => {
            assert.equal(err);
            next();
         });
      }
   } else {
      next();
   }
};

// generate nginx conf
const confNginx = function(){
   var nginx = this.appConf.nginx;

   if(nginx && this.appConf.modified) {
      var tpl = "";

       new util.que(this)

      .add((done) => {
         fs.readFile(util.parsePaths(nginx.template), "utf8", (err, data) => {
            if (err) console.error("confNginx", err);
            else {
               tpl = data;
               done();
            }
         });
      })

      .then(() => {
         tpl = tpl
         .replace("<<title>>", this.appConf.name + " " + this.appConf.version)
         .replace("<<domains>>", nginx.domains)
         .replace("<<srcerer>>", nginx.srcerer);

         // replace any <<key>> from nginx.paths in template
         for(var key in nginx.paths) {
             tpl = tpl.replace("<<" + key + ">>", util.parsePaths(
                nginx.paths[key]
             ));
         }

         fs.writeFile(util.parsePaths(nginx.file), tpl, "utf8", (err) => {
            if(err) assert.equal(err);
            else console.log("'%s' new\x1b[36m nginx", this.appConf.name);
         });
      });
   }
};

// export build
module.exports = function () {
   // this = {
   //    configuration
   //    configurationFilePath
   //    express: {
   //       req
   //       res
   //       next
   //    },
   //    mountType
   //    mountPoint
   //    root
   //    util
   // }

   new util.que({
      server: this.express.req.server,
      runtime: this.express.req.runtime,
      res: this.express.res,
      urlBase: this.express.req.baseUrl,
      urlPath: this.express.req.path,
      build: undefined,
      appConf: undefined,
      blobs: [],
      debug: this.express.req.query.debug === "true",
      exit: this.express.next
   })

   .add(getBuildName)
   .add(loadApplicationConfiguration)
   .add(setStaticRoot)
   .add(makeStaticRoot)
   .add(serveStaticRoot)
   .add(controlCache)
   .add(confLess)
   .add(blobsConfigure)
   .add(blobsStaticRoot)
   .add(blobsCompile)
   .add(parseBubbles)
   .add(indexWrite)
   .add(function(next) {
      this.exit();
      next();
   })
   .then(confNginx);
};

