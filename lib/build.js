/*!
* Srcerer, build tool
* Copyright(c) 2010-2017 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const fs = require("fs");
const path = require("path");
const assert = require("assert");
const ugly = require("uglify-js");
const less = require("less");
const util = require("./util");
const svgo = new (require("svgo"))({
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
});

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

const confLess = function(compress) {
   // paths for @import
   return {
      paths: (() => {
         var lessImportPaths = [];
         this.appConf.stylePaths.forEach((stylePath) => {
            lessImportPaths.push(path.join(this.appRoot + stylePath));
         });
         return lessImportPaths;
      })(),
      filename: "Cannot parse less", // for error messages
      compress: compress
   };
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
            this.lessConfSrc = confLess.call(this, false);
            this.lessConfWww = confLess.call(this, true);
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

const setRoot = function(next){
   var createRootDirectories = new util.que(this);
   // set static source root
   if(
      this.appConf.staticSrc &&
      this.appConf.staticSrc.constructor === String
   ) {
      this.staticSrc = path.join (
         this.appRoot,
         this.appConf.staticSrc
      );
      createRootDirectories.add(makeStaticRootSrc);
   } else {
      console.error("setRoot, required: appConf.staticSrc");
      this.res.status(500).send("Expected staticSrc");
      return;
   }

   // set static www root
   if(
      this.appConf.staticRoot &&
      this.appConf.staticRoot.constructor === String
   ) {
      this.staticRoot = path.join (
         this.appRoot,
         this.appConf.staticRoot
      );
      createRootDirectories.add(makeStaticRootWww);
   } else {
      console.error("setRoot, required: appConf.staticRoot");
      this.res.status(500).send("Expected staticRoot");
      return;
   }

   // create missing root directories
   createRootDirectories.then(next);
};

// root directory for static source
const makeStaticRootSrc = function(next){
   var exists;
   new util.que(this)

   .add((next) => {
      fs.exists(this.staticSrc, function(existing){
         exists = existing;
         next();
      });
   })

   .then(() => {
      if (exists){
         next();
      } else {
         console.log("'%s', new path '%s'", this.appConf.name, this.staticSrc);
         fs.mkdir(this.staticSrc, "0775", () => {
            next();
         });
      }
   });
};

// root directory for static www
const makeStaticRootWww = function(next){
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

const serveRoot = function(next) {
   // remove previous static routes
   this.runtime.router.stack.filter(function(s){
      return s.path && s.path.indexOf("/app/") === 0;
   }).forEach(staticRoute => {
       this.runtime.router.stack.splice(this.runtime.router.stack.indexOf(staticRoute), 1);
   });

   // express serve static source
   if(this.debug && this.staticSrc) {
      this.runtime.router.use(this.urlBase, this.runtime.static(this.staticSrc));
   }

   // express serve static www
   else if(this.staticRoot) {
      this.runtime.router.use(this.urlBase, this.runtime.static(this.staticRoot));
   }

   // exit for serving static files
   if(this.urlPath.length > 1 && this.urlPath != "/index.html") {
      this.exit();
   }

   // else continue to build index.html
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
      blobSrcRoot: this.blobSrcRoot,
      lessConfSrc: this.lessConfSrc,
      lessConfWww: this.lessConfWww,
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
      "/bin/"
   );

   // define static root for blob source
   this.blobSrcRoot = path.join(
      this.staticSrc,
      "/bin/"
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
   const createRoot = (path, done) => {
      var exists;
      new util.que(this)

      .add((next) => {
         fs.exists(path, function(existing){
            exists = existing;
            next();
         });
      })

      .then(() => {
         if (exists){
            done();
         } else {
            console.log("'%s', new path '%s'", this.appConf.name, path);
            fs.mkdir(path, "0775", () => {
               done();
            });
         }
      });
   };

   new util.all()
   .add((done) => {
      createRoot(this.blobSrcRoot, done);
   })
   .add((done) => {
      createRoot(this.blobRoot, done);
   })
   .then(next);
};

const blobCss = function(next) {
   fs.readFile(this.cssFile, "utf8", (err, data) => {
      if (err) {
         console.error("Blob, style sheet not found", this.cssFile);
         this.css = false;
         next();
      } else {
         new util.que(this)

         // compile css source
         .add((done) => {
            less.render(data, this.lessConfSrc, (lessErr, cssResult) => {
               if (lessErr) {
                  console.error(lessErr);
                  this.cssSrc = false;
               } else {
                  this.cssSrc = cssResult.css;
               }
               done();
            });
         })

         // compile css www
         .add((done) => {
            less.render(data, this.lessConfWww, (lessErr, cssResult) => {
               if (lessErr) {
                  console.error(lessErr);
                  this.css = false;
               } else {
                  this.css = cssResult.css;
               }
               done();
            });
         })

         .then(next);
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
         this.svgSrc = data;
         svgo.optimize(data).then((result) => {
            this.svg = result.data;
            done();
         }).catch((e) => {
            console.error("blobSvg", e);
            done();
         });
      }
   });
};

// blob compile mvc
const blobMvc = function(done) {
   var blob = this;

   var parseBlob = (data) => {
      // shim bubbleSet
      this.mvcSrc = [
         this.debug ? "//# sourceURL=" + this.name + "\n" : "",
         "bubbleSet." + this.name + "(function(){\n",
         this.css ? "this.css = true;\n" : "",
         this.svg ? "this.svg = true;\n" : "",
         data,
         "});"
      ].join("");

      this.mvc = ugly.minify(this.mvcSrc, {
         warnings: true,
         mangle: true
      }).code;

      done();
   };

   if(blob.mvc) {
      fs.readFile(this.mvcFile, "utf8", (err, data) => {
         if(err) {
            console.error("Blob, mvc not found", this.mvcFile);
            done();
         } else {
            parseBlob(data);
         }
      });
   } else {
      parseBlob("");
   }
};

// blob write to disk
const blobExport = function(done) {
   const blobTypes = {
      "css": {
         ext: ".css",
         path: this.blobRoot
      },
      "cssSrc": {
         ext: ".css",
         path: this.blobSrcRoot
      },
      "mvc": {
         ext: ".js",
         path: this.blobRoot
      },
      "mvcSrc": {
         ext: ".js",
         path: this.blobSrcRoot
      },
      "svg": {
         ext: ".svg",
         path: this.blobRoot
      },
      "svgSrc": {
         ext: ".svg",
         path: this.blobSrcRoot
      }
   };

   const writeFile = (file, data, done) => {
         fs.writeFile(file, data, "utf8", (err) => {
            assert.equal(err);
            done();
         });
   };

   const writeQue = new util.all(this);

   for(const key in blobTypes) {
      /* jshint loopfunc: true */
      if(this[key]) {
         const type = blobTypes[key];
         writeQue.add((done) => {
            writeFile(type.path + this.name + type.ext, this[key], done);
         });
      }
   }

   writeQue.then(done);
};

// compile changed blobs simultaneously
const blobsCompile = function(next) {
   var logTime = (t) => { return t ? new Date(t).toString() : "unchanged";};
   var compiling = new util.all();

   this.blobs.forEach((blob) => {
      compiling.add((done) => {
         var parts = new util.all(blob);

         console.log("'%s' blob %s", this.appConf.name, blob.name);

         if(blob.css) {
            console.log("\tCSS %s", logTime(blob.cssModified));
            parts.add(blobCss);
         }

         if(blob.svg) {
            console.log("\tSVG %s", logTime(blob.svgModified));
            parts.add(blobSvg);
         }

         console.log("\tMVC %s", logTime(blob.mvcModified));
         parts.add(blobMvc);

         parts.then(() => {
            blobExport.call(blob, done);
         });
      });
   });
   compiling.then(next);
};

// parse client side dependencies
const parseBubbles = function(ready) {
   if(this.appConf.modified) {
      var pathBubbles = __dirname + "/bubbles.js";
      fs.readFile(pathBubbles, "utf8", (err, data) => {
         if(err) {
            console.error(`bubbles.js, fs.readFile: ${err}`);
            ready();
         } else {
            new util.all()

            // write minified to www
            .add((done) => {
               // minify if not in debug mode
               var uglyfied = ugly.minify(data, {
                  warnings: true,
                  mangle: true
               });
               assert.equal(uglyfied.error);
               const dataWww = uglyfied.code;

               const filePath = path.join(
                  this.blobRoot,
                  "bubbles.js"
               );

               fs.writeFile(filePath, dataWww, "utf8", (err) => {
                  assert.equal(err);
                  done();
               });
            })

            .add((done) => {
               const filePath = path.join(
                  this.blobSrcRoot,
                  "bubbles.js"
               );

               fs.writeFile(filePath, data, "utf8", (err) => {
                  assert.equal(err);
                  done();
               });
            })

            .then(ready);
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

      // index
      if (this.appConf.index) {
         var writeIndex = new util.all();

         // write to static root
         if(this.staticRoot) {
            writeIndex.add((done) => {
               fs.writeFile(path.join(this.staticRoot, this.appConf.index), dom.parse(), "utf8", (err) => {
                  assert.equal(err);
                  done();
               });
            });
         }

         // write to static source
         if(this.staticSrc) {
            writeIndex.add((done) => {
               fs.writeFile(path.join(this.staticSrc, this.appConf.index), dom.parse(), "utf8", (err) => {
                  assert.equal(err);
                  done();
               });
            });
         }

         writeIndex.then(next);
      } else {
         next();
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
            else console.log("'%s' new nginx", this.appConf.name);
         });
      });
   }
};

// generate nginx conf
const exitBuild = function(next){
   this.exit();
   next();
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
   .add(setRoot)
   .add(serveRoot)
   .add(controlCache)
   .add(blobsConfigure)
   .add(blobsStaticRoot)
   .add(blobsCompile)
   .add(parseBubbles)
   .add(indexWrite)
   .add(exitBuild)
   .then(confNginx);
};

