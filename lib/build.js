/*!
* Srcerer, build tool
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const fs = require("fs-extra");
const path = require("path");
const ugly = require("uglify-js");
const less = require("less");
const svgo = require("svgo");
const util = require("./util");

const getBuildName = function(next) {
   var basePath = this.urlBase.split(path.sep);
   if(basePath.length) {
      this.build = basePath.pop();
      this.session.build = this.build;

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
      this.server.root,
      this.server.appsRoot,
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
   fs.readFile(this.mvcFile, "utf8", (err, data) => {
      if(err) {
         console.error("Blob, mvc not found", this.mvcFile);
         done();
      } else {
         if (!this.debug) {
            data = ugly.minify(data, {
               fromString: true,
               mangle: true
            }).code;
         }

         this.mvc = "\n" + data;
      }
      done();
   });
};

// blob write to disk
const blobExport = function(done) {
   var blob = `({\nname:"${this.name}"`;

   if (this.css) {
      blob += `,\ncss:"${ this.css.replace(/"/g, '\\"') }"`;
   }

   if (this.svg) {
      blob += `,\nsvg:"${ this.svg.replace(/"/g, '\\"') }"`;
   }

   if (this.mvc) {
      blob += `,\nmvc:new function(){${ this.mvc }}`;
   }

   blob += "\n})";

   // debugger source mapping
   if(this.debug){
      blob = "//# sourceURL=" + this.name + "\n" + blob;
   }

   fs.writeFile(this.blobRoot + this.name + ".js", blob, "utf8", done);
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

const indexInlineScripts = function (next) {
   if(this.appConf.modified) {
      this.indexInlineScripts = [];

      // bubbles.js is mandatory first inline script
      var scripts = [{
         name: "bubbles.js",
         path: __dirname + "/bubbles.js"
      }];

      // attach more lib files to app root
      if(this.appConf.inlineScripts) this.appConf.inlineScripts.forEach((script) => {
         scripts.push({
            name: script,
            path: this.appRoot + script
         });
      });

      // individual inline scripts
      var index = 0;
      var loadScripts = new util.all();
      scripts.forEach((script) => {
         var myIndex = index;
         index ++;

         loadScripts.add((done) => {
            fs.readFile(script.path, "utf8", (err, data) => {
               if(err) {
                  console.error(`indexInlineScripts, fs.readFile: ${
                     err
                  }`);
               } else {
                  // minify if not in debug mode
                  if(!this.debug) {
                     data = ugly.minify(data, {
                        fromString: true,
                        mangle: true
                     }).code;
                  }

                  this.indexInlineScripts[myIndex] = `\n/* ${script.name} */ ${data}`;
               }
               done();
            });
         });
      });

      loadScripts.then(next);
   } else {
      next();
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
         this.server.name || "server"
      } v${
         this.server.version || 0
      } ${
         new Date()
      }`);

      // meta tags
      if(this.appConf.meta && this.appConf.meta.length) {
         this.appConf.meta.forEach(function (meta) {
            dom.head("meta", false, meta);
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

      // inline css
      if(this.indexInlineCss) {
         dom.style(this.indexInlineCss);
      }

      // external Javascript
      if(this.appConf.externalScripts) {
         this.appConf.externalScripts.forEach((ext) => {
            dom.head("script", false, ext);
         });
      }

      // inline scripts
      if(this.indexInlineScripts) {
         this.indexInlineScripts.forEach((inlineScript) => {
            dom.script(inlineScript);
         });
      }

      // write to disk
      if (this.appConf.index) {
         fs.writeFile(this.staticRoot + this.appConf.index, dom.parse(), "utf8", next);
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

      .add((done) => {
         fs.ensureFile(util.parsePaths(nginx.file), function (err) {
            if(err) console.error("confNginx", err);
            else done();
         });
      })

      .then(() => {
         tpl = tpl
            .replace("<<title>>", this.appConf.name + " " + this.appConf.version)
            .replace("<<domains>>", nginx.domains)
            .replace("<<errors>>", util.parsePaths(nginx.errors))
            .replace("<<srcerer>>", nginx.srcerer)
            .replace("<<app>>", util.parsePaths(nginx.root))
            .replace("<<crt>>", util.parsePaths(nginx.crt))
            .replace("<<key>>", util.parsePaths(nginx.key));

         fs.writeFile(util.parsePaths(nginx.file), tpl, "utf8", (err) => {
            if(err) console.error("confNginx", err);
            else console.log(`New nginx conf for "${this.build}"`);
         });
      });
   }
};

// export build
module.exports = function (req, res, exit) {
   new util.que({
      server: req.server,
      runtime: req.runtime,
      session: req.session,
      res: res,
      urlBase: req.baseUrl,
      urlPath: req.path,
      build: undefined,
      appConf: undefined,
      blobs: [],
      debug: req.query.debug === "true",
      exit: exit
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
   .add(indexInlineCss)
   .add(indexInlineScripts)
   .add(indexWrite)
   .add((next) => {
      exit();
      next();
   })
   .then(confNginx);
};

