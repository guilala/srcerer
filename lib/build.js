/*!
* Srcerer build tool
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/

const fs = require("fs-extra");
const url = require("url");
const path = require("path");
const ugly = require("uglify-js");
const less = require("less");
const svgo = require("svgo");
const util = require("./util");

const getBuildName = function(next) {
   this.path = this.path.filter(String);
   this.build = this.path.shift();
   this.session.build = this.build;
   next();
};

const controlCache = function(next) {
   if (this.runtime.lastDebugMode !== this.debug) {
      util.clearModificationCache();
      this.runtime.lastDebugMode = this.debug;
   }
   next();
};

const loadApplicationConfiguration = function(next) {
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

const serveStatic = function(next){
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

// ensure root for static files
const staticRoot = function(next){
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

   util.all()

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
         console.error("Blob, style sheet not found", cssFile);
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
            done();
         });
      }
   });
};

// blob compile mvc
const blobMvc = function(done) {
   fs.readFile(this.mvcFile, "utf8", (err, data) => {
      if(err) {
         console.error("Blob, mvc not found", mvcFile);
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
   var compiling = util.all();

   this.blobs.forEach((blob) => {
      compiling.add((done) => {
         var parts = util.all(blob);

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
   if(this.appConf.inlineCss) {
      // combine less files
      var lessSource = [];

      var index = 0;
      var loadLessFiles = util.all();
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
   var loadScripts = util.all();
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
};

// parse index.html and write to disk
const indexWrite = function (next) {
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
   if(this.appConf.meta.length) {
      this.appConf.meta.forEach(function (meta) {
         dom.head("meta", false, meta);
      });
   }

   // title
   dom.head("title", this.appConf.name);

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

   // index html string
   var indexHtml = dom.parse();

   // send result
   this.res.send(indexHtml);

   // write to disk
   if (this.appConf.index) {
      fs.writeFile(this.staticRoot + this.appConf.index, indexHtml, "utf8", next);
   }
};

// generate nginx conf
const confNginx = function(next){
   if(this.appConf.nginx && this.appConf.nginx != this.runtime.lastConfNginx){
      console.log("creating nginx conf");
      this.runtime.lastConfNginx = this.appConf.nginx;
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
module.exports = function (req, res, next) {
   util.que({
      server: req.server,
      runtime: req.runtime,
      session: req.session,
      res: res,
      path: url.parse(req.originalUrl).pathname.split(path.sep),
      build: undefined,
      appConf: undefined,
      blobs: [],
      debug: req.query.debug === "true"
   })

   .add(getBuildName)
   .add(controlCache)
   .add(loadApplicationConfiguration)
   .add(serveStatic)
   .add(confLess)
   .add(staticRoot)
   .add(blobsConfigure)
   .add(blobsStaticRoot)
   .add(blobsCompile)
   .add(indexInlineCss)
   .add(indexInlineScripts)
   .add(indexWrite)
   .then(() => {
      next();
   });
};

