/*!
* Srcerer, util
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

const fs = require("fs-extra");
const hash = require("string-hash");
const path = require("path");
const untildify = require('untildify');

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
   }
};

// fs directorie helpers
const dir = {
   list: function (Path) {
      if (fs.existsSync(Path)) {
         return fs.readdirSync(Path);
      } else return false;
   },

   getDirectories: function(srcpath){
      return fs.readdirSync(srcpath).filter(function(file) {
         return fs.statSync(srcpath + file).isDirectory();
      });
   }
};

// normalise path strings
const parsePaths = function(paths) {
   return untildify(
      path.resolve.apply(
         {},
         obj.arrayify(paths)
      )
   );
};

// basic html generator
const dombo = function(){
   var innerHead = [""];

   var tag = (type, content, attr) => {
      var chunks = [`<${type}`];

      for(var key in attr) {
         chunks.push(` ${key}="${attr[key]}"`); 
      }

      if(content) {
         chunks.push(`>${content}</${type}>`);
      } else {
         chunks.push("/>");
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
            fs.readJson(path, (err, jsonData) => {
               if(err) {
                  reject(err);
               } else {
                  resolve(jsonLoaded[name] = jsonData);
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
   dombo: dombo,
   que: que,
   all: all,
   modified: modified,
   clearModificationCache: clearModificationCache,
   localJson: localJson
};

