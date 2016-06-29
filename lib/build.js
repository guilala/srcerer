/*!
 * Srcerer build tool
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

(function(){
   var fs = require("fs-extra");
   var path = require("path");
   var ugly = require("uglify-js");
   var less = require("less");
   var svgo = require("svgo");
   var util = require("./util");

   // export build
   module.exports = function (req, res, exit) {
      var que = new util.Que({
         server: req.server,
         session: req.session,
         res: res,
         path: req.originalUrl.split("/"),
         build: undefined,
         appConf: undefined,
         blobs: [],
         previousDebugMode: false
      });

      que.push(getBuildName);
      que.push(loadApplicationConfiguration);
      que.push(serveStatic);
      que.push(confLess);
      // que.push(confNginx);
      que.push(makeStaticRoot);
      que.push(blobsConfigure);
      que.push(blobscreateTargetRoot);
      que.then(() => {
         console.log("exit build");
         exit();
      });      
   };

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
         this.appConf.static
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

   // make sure the root of static files exists
   var makeStaticRoot = function(next){
      if (!fs.existsSync(this.staticRoot)) {
         console.log("Create static dir '%s' for '%s'", this.staticRoot, this.appConf.name);
         fs.mkdirSync(this.staticRoot, "0775");
      }
      next();
   };

   // find and configure all blobs
   var blobsConfigure = function(next) {
      var addBlob = (blobName, done) => {
         var pathPrefix = this.path.join(
            this.appRoot,
            blobPath,
            blobName,
            "/",
            blobName
         );

         var blob = {
            mvcFile: pathPrefix + ".js",
            mvcModified: undefined,

            cssFile: pathPrefix + ".less",
            cssModified: undefined,

            svgFile: pathPrefix + ".svg",
            svgModified: undefined
         };

         var modified = new util.All(this);

         // is mvc modified
         modified.push((done) => {
            util.modified(blob.mvcFile, function (state) {
               blob.mvcModified = state;
               done();
            });
         });

         // is css modified
         modified.push((done) => {
            util.modified(blob.cssFile, function (state) {
               blob.cssModified = state;
               done();
            });
         });

         // is svg modified
         modified.push((done) => {
            util.modified(blob.svgFile, function (state) {
               blob.svgModified = state;
               done();
            });
         });

         // async get modified
         modified.then(() => {
            if(blob.mvcModified || blob.cssModified || blob.svgModified) {
               this.blobs.push(blob);
            }
            done();
         });
      };

      // get all blobs
      var configureBlobs = util.All(this);
      this.appConf.blobPaths.forEach(function (blobPath) {
         // direct child directories are blob sources
         util.dir.getDirectories(blobPath).forEach((blobName) => {
            configureBlobs.push((done) => {
               addBlob.call(this, blobName, done);
            });
         });
      });

      // async configure all blobs
      configureBlobs.then(next);
   };

   // parse blobs
   var blobscreateTargetRoot = function(next){
      this.blobRoot = path.join(
         this.staticRoot,
         "bin/"
      );

      var exists = false;
      var que = new util.Que(this);

      que.push(function(next){
         fs.exists(this.blobRoot, function(){
            next();
         });
      });
      
      que.then(() => {
         if (exists){
            next();
         } else {
            console.log("'%s' Create bin", app.name);
         }
      });
      if (!fs.existsSync()) {
         
         forceBuild = true;
         fs.mkdirSync(blobRoot, "0775");
      }
      next();
   };
   
   var startQue = function (req, res, app, next) {
      var debug = req.query.debug == "true";
      var forceBuild = req.query.force == "true";
      var mainQue = new util.Que(this);

      if (debug != previousDebugMode) {
         forceBuild = true;
         previousDebugMode = debug;
      }


      // parse blobs
      mainQue.push(function (mainResolve) {
         if (app.blobPath && app.blobPath.length) {
            // create blob root dir when not there
            

            app.blobPath.forEach(function (blobPath) {
               blobPath = app.root + blobPath;

               // every dir found in path is a blob
               var blobs = util.dir.getDirectories(blobPath);
               // console.log("Blobs found", blobs);

               blobs.forEach(function (id) {
                  var blobMod = new util.All(this);
                  var path = blobPath + id + "/" + id;
                  var cssSrc = path + ".less", cssMod;
                  var mvcSrc = path + ".js", mvcMod;
                  var svgSrc = path + ".svg", svgMod;

                  blobMod.push(function (done) {
                     util.modified(cssSrc, function (state) {
                        cssMod = state;
                        done();
                     });
                  });

                  blobMod.push(function (done) {
                     util.modified(mvcSrc, function (state) {
                        mvcMod = state;
                        done();
                     });
                  });

                  blobMod.push(function (done) {
                     util.modified(svgSrc, function (state) {
                        svgMod = state;
                        done();
                     });
                  });

                  var compileBlob = function (resolveBlob) {
                     var blobAll = new util.All(this), css, svg, mvc;

                     // blob style
                     if (cssMod !== undefined) {
                        blobAll.push(function (resolve) {
                           fs.readFile(cssSrc, "utf8", function (err, data) {
                              if (err) {
                                 console.error("Blob, style sheet not found", cssSrc);
                                 resolve();
                              } else {
                                 less.render(data, lessConfig, function (lessErr, cssResult) {
                                    if (!lessErr) {
                                       css = cssResult.css;
                                       // console.log("Got css", css);
                                    } else {
                                       console.log(lessErr);
                                    }
                                    resolve();
                                 });
                              }
                           });
                        });
                     }

                     // blob svg sprite
                     if (svgMod !== undefined) {
                        blobAll.push(function (resolve) {
                           fs.readFile(svgSrc, "utf8", function (err, data) {
                              if (err) {
                                 console.error("Blob, svg not found", svgSrc);
                                 resolve();
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
                                 }).optimize(data, function (result) {
                                    svg = result.data;
                                    // console.log("Got svg", svg);
                                    resolve();
                                 });
                              }
                           });
                        });
                     }

                     // blob mvc
                     if (mvcMod !== undefined) {
                        blobAll.push(function (resolve) {
                           fs.readFile(mvcSrc, "utf8", function (err, data) {
                              if(err) {
                                 console.error("Blob, mvc not found", mvcSrc);
                              } else {
                                 if (!debug) {
                                    mvc = ugly.minify(data, {
                                       fromString: true,
                                       mangle: true
                                    }).code.slice(1).slice(0, -3) + "()"; // replace !() with ()()
                                 } else {
                                    mvc = data;
                                 }
                              }
                              resolve();
                           });
                        });
                     }

                     // output
                     blobAll.then(function () {
                        var blob = '({\nb:"' + id + '"';

                           if (css) {
                              blob += ',\ns:"' + css.replace(/"/g, '\\"') + '"';
                           }

                           if (svg) {
                              blob += ',\ni:"' + svg.replace(/"/g, '\\"') + '"';
                           }

                           if (mvc) {
                              blob += ',\nm:' + mvc;
                           }

                           blob += "\n})";

                           if(debug){
                              // list as source in debugger
                              blob = "//# sourceURL=" + id + "\n" + blob;
                           }

                           fs.writeFile(blobRoot + id + ".js", blob, "utf8");

                           // log
                           var tm = function(t){ return t ? new Date(t).toString() : "unchanged";};
                           console.log("'%s' blob \x1b[36m%s\x1b[0m", app.name, id);
                           if(cssMod || svgMod || mvcMod || forceBuild){
                              if(css) console.log("\x1b[34m\tCSS %s\x1b[0m", tm(cssMod));
                              if(svg) console.log("\x1b[32m\tSVG %s\x1b[0m", tm(svgMod));
                              if(mvc) console.log("\x1b[33m\tMVC %s\x1b[0m", tm(mvcMod));
                           } else console.log("\x1b[31m\tEmpty\x1b[0m");

                           resolveBlob();
                        });
                     };

                     all.push(function (resolve) {
                        blobMod.then(function () {
                           if (cssMod || svgMod || mvcMod || forceBuild) {
                              compileBlob(resolve);
                           } else {
                              resolve();
                           }
                        });
                     });
                  });
               });

               // blobs done
               all.then(function () {
                  // console.info("All blobs parsed...");
                  mainResolve();
               });
            } else {
               mainResolve();
            }
         });

         // parse index.html
         mainQue.push(function (mainResolve) {
            var
               dom = new util.Dombo(),
            into = util.string.into,
            style = "\n";

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

         mainQue.then(function () {
            // finish request
            next();
            // nginx
            confNginx(server, app);
         });
      };

   // generate nginx conf 
   var confNginx = function(next){
      if(this.appConf.nginx && this.appConf.nginx != this.server.runtime.lastConfNginx){
         console.log("creating nginx conf");
         this.server.runtime.lastConfNginx = this.appConf.nginx;

         var steps = new util.Que(this);
         var tpl = "";

         steps.push(function(resolve){
            fs.readFile(app.nginx.template, "utf8", function (err, data) {
               if (err) console.error("confNginx", err);
               else {
                  tpl = data;
                  resolve();
               }
            });
         });

         steps.push(function(resolve){
            fs.ensureFile(app.nginx.file, function (err) {
               if(err) console.error("confNginx", err);
               else resolve();
            });
         });

         console.log("nginx2");
         steps.then(function() {
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

}())

