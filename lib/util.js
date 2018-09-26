/*!
* Srcerer, utils
* Copyright(c) 2010-2017 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

/*jslint node: true */
"use strict";

const fs = require("fs");
const hash = require("string-hash");
const path = require("path");
const untildify = require("untildify");

var modificationCache = {};
var jsonLoaded = {};

// object helpers
const obj = {
   // object child key count
   keyCount: function (obj) {
      if (obj.constructor === Object) {
         return Object.keys(obj).length;
      } else return 0;
   },

   isArray: function (obj) {
      return obj && obj.constructor === Array;
   },

   // shallow merge to first object
   merge: function (objA, objB) {
      for (var key in objB) objA[key] = objB[key];
      return objA;
   },

   // shallow merge to new object
   mergeTo: function (objA, objB) {
      var result = {};
      for (var keyA in objA) result[keyA] = objA[keyA];
      for (var keyB in objB) result[keyB] = objB[keyB];
      return result;
   },

   // wrap array when isn't array
   arrayify: function (obj) {
      if (Array.isArray(obj)) {
         return obj;
      } else {
         return [obj];
      }
   },

   // walk path, and apply matches
   walk: function(src, path, act){
      path.split(".").forEach(function(next){
         if(src !== path && src.hasOwnProperty(next)) src = src[next];
         else src = path;
      });

      if(act && src !== path) {
         obj.arrayify(src).forEach(act);
      }

      return src !== path ? src : undefined;
   }
};

// normalize path strings
const parsePaths = function(paths) {
   paths = obj.arrayify(paths);
   paths.forEach((segment, index, pathsArray) => {
      if(segment) {
         pathsArray[index] = untildify(segment);
      } else {
         pathsArray[index] = "";
      }
   });
   return path.resolve.apply({}, paths);
};

// fs directorie helpers
const dir = {
   list: function (Path) {
      if (fs.existsSync(Path)) {
         return fs.readdirSync(Path);
      } else return false;
   },

   getDirectories: function(srcPath){
      return fs.readdirSync(srcPath).filter(function(file) {
         return fs.statSync(parsePaths([srcPath, file])).isDirectory();
      });
   }
};

// basic html generator
const dombo = function(){
   var innerHead = [""];

   var tag = (type, content, attr) => {
      var chunks = [`<${type}`];

      for(var key in attr) {
         if(attr[key]) {
            chunks.push(` ${key}="${attr[key]}"`);
         } else {
            chunks.push(` ${key}`);
         }
      }

      if(content === false) {
         chunks.push("/>");
      } else {
         chunks.push(`>${content}</${type}>`);
      }

      return chunks.join("");
   };

   this.head = function (type, content, attr) {
      innerHead.push(tag(type, content, attr));
   };

   this.comment = function(content) {
      innerHead.push("<!-- " + content + " -->");
   };

   this.style = function (content) {
      innerHead.push(tag("style", content, {"type": "text/css"}));
   };

   const untildify = require('untildify');this.script = function (content) {
      innerHead.push(tag("script", content + "\n", {"type": "text/javascript"}));
   };

   this.parse = function(){
      innerHead.push("");
      var docType = "<!DOCTYPE html>\n";
      var head = `${tag("head", innerHead.join("\n"))}`;
      var body = "<body></body>";
      var innerHtml = `${head}${body}`;
      return `${docType}${tag("html", innerHtml, {lang:"en"})}\n`;
   };
};

// call async functions sequentially, finish when they are done
const que = function (context) {
   var self = this;
   var row = [];

   var next = () => {
      if (row.length) {
         new Promise((resolve, reject) => {
            row.shift().call(context || self, resolve, reject);
         }).then(next);
      }
   };

   this.add = (step) => {
      if (step && step.call) {
         row.push(step);
      } else {
         console.error("util.que: not a function");
      }

      return self;
   };

   this.then = (action) => {
      self.add(action);
      next();

      return self;
   };

   return self;
};

// call async functions simultaneously, finish when they are done
const all = function (context) {
   var self = this;
   var list = [];

   this.add = (action) => {
      if (action && action.call) {
         list.push(action);
      } else {
         console.error("util.all, add: not a function");
      }

      return self;
   };

   this.then = (finalAction) => {
      new Promise((resolve) => {
         var count = list.length;
         if(count) {
            list.forEach((action) => {
               action.call(context || self, () => {
                  // individual resolve
                  count--;
                  // total resolve
                  if (count === 0) {
                     resolve();
                  }
               });
            });
         } else resolve();
      }).then(() => {
         if(finalAction && finalAction.call) {
            finalAction.call(context || self);
         }
      });

      return self;
   };

   return self;
};

// is file modified since process start or last call
const modified = function (path, name) {
   return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
         if(err){
            reject(err);
         } else {
            var modified = new Date(stats.mtime).getTime();
            if (modificationCache.hasOwnProperty(name) && modified <= modificationCache[name]) {
               modified = false;
            } else {
               modificationCache[name] = modified;
            }
            resolve(modified);
         }
      });
   });
};

const clearModificationCache = function() {
   modificationCache = {};
};

// load, and cache local json
const localJson = function(path){
   return new Promise((resolve, reject) => {
      var name = hash(path);
      modified(path, name).then((isModified) => {
         if(isModified){
            fs.readFile(path, 'utf8', function (err, data) {
               if (err) {
                  console.error(err);
                  reject(err);
               } else {
                  try {
                     resolve(jsonLoaded[name] = JSON.parse(data));
                  } catch (parseError) {
                     console.error(parseError);
                     reject(parseError);
                  }
               }
            });
         } else {
            resolve(jsonLoaded[name]);
         }
      }, (err) => {
         reject(err);
      });
   });
};

// map to module export
module.exports = {
   obj: obj,
   dir: dir,
   parsePaths: parsePaths,
   dombo: dombo,
   que: que,
   all: all,
   modified: modified,
   clearModificationCache: clearModificationCache,
   localJson: localJson
};

