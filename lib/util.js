/*!
* Srcerer
* Copyright(c) 2010-2015 Jesse Tijnagel
* MIT Licensed
*/

var fs = require("fs-extra");
var hash = require("string-hash");
var mTime = {};
var jsonLoaded = {};

// object helpers
var obj = {
   length: function (objA) {
      if (typeof objA == "object") return Object.keys(objA).length;
   },

   merge: function (objA, objB) {
      for (var key in objB) objA[key] = objB[key];
      return objA;
   },

   mergeTo: function (objA, objB) {
      var result = {};
      for (var keyA in objA) result[keyA] = objA[keyA];
      for (var keyB in objB) result[keyB] = objB[keyB];
      return result;
   }
};

// fs directorie helpers
var dir = {
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

// basic html generator
var dombo = function(){
   var innerHead = [""], tag = function(type, content, attr){
      return "<" + type + function(){
         var res = "";
         for(var k in attr) res += " " + k + (attr[k] ? "=\"" + attr[k] + "\"" : "");
         return res;
      }() + (content ? ">" + content + "</" + type + ">" : "/>");
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

   this.script = function (content) {
      innerHead.push(tag("script", content, {"type": "text/javascript"}));
   };

   this.parse = function(){
      return "<!DOCTYPE html>\n" + tag("html", tag("head", innerHead.join("\n")) + "<body></body>", {lang:"en"});
   };
};

// call async functions sequentially, finish when they are done
var que = function (context) {
   var self = this;
   var row = [];

   var next = function () {
      if (row.length) {
         new Promise(function (resolve, reject) {
            row.shift().call(context || self, resolve, reject);
         }).then(next);
      }
   };

   this.add = function (step) {
      if (step && step.call) {
         row.push(step);
      } else {
         console.error("util.que: not a function");
      }
      
      return self;
   };

   this.then = function(action){
      self.add(action);
      next();
      
      return self;
   };

   return self;
};

// call async functions simultaneously, finish when they are done
var all = function (context) {
   var self = this;
   var list = [(done) => {
      done();
   }];

   this.add = function (action) {
      if (action && action.call) {
         list.push(action);
      } else {
         console.error("util.all, add: not a function");
      }

      return self;
   };

   this.then = function (action) {
      if (action.call) {
         new Promise(function (resolve) {
            var count = 0;
            list.forEach(function (action) {
               action.call(context || self, () => {
                  // individual resolve
                  count++;
                  if (count == list.length) {
                     // total resolve
                     resolve();
                  }
               });
            });
         }).then(function () {
            action.call(context || self);
         });
      } else {
         console.warn("exports.All, then: function expected");
      }

      return self;
   };

   return self;
};

// is file modified since process start or last call
var modified = function (path, name) {
   return new Promise(function (resolve, reject) {
      fs.stat(path, function (err, stats) {
         if(err){
            reject(err);
         } else {
            var modified = new Date(stats.mtime).getTime();
            if (mTime.hasOwnProperty(name) && modified <= mTime[name]) {
               modified = false;
            } else {
               mTime[name] = modified;
            }
            resolve(modified);
         }
      });
   });
};

// load, and cache local json
var localJson = function(path){
   return new Promise(function (resolve, reject) {
      var name = hash(path);
      modified(path, name).then((isModified) => {
         if(isModified){
            fs.readJson(path, function (err, jsonData) {
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
   localJson: localJson
};

