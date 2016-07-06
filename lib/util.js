/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

if(module.parent) {
   var fs = require("fs-extra");
   var hash = require("string-hash");
   var mTime = {};
   var jsonLoaded = {};

   // objects
   exports.obj = {
      length: function (obj) {
         if (typeof obj == "object") return Object.keys(obj).length;
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

   // directories
   exports.dir = {
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
   exports.Dombo = function(){
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

   // call everyone after eachother
   exports.Que = function (scope) {
      var self = this;
      var row = [];

      var next = function () {
         if (row.length) {
            new Promise(function (resolve, reject) {
               row.shift().call(scope || window, resolve, reject);
            }).then(next);
         }
      };

      this.push = function (step) {
         if (step.call) {
            row.push(step);
         } else {
            console.warn("util.Que, push: function expected");
         }

         return self;
      };

      this.then = function(action){
         if(action) row.push(action);
         next();

         return self;
      };

      return self;
   };

   // call everyone and waits till all finished
   exports.All = function (scope) {
      var self = this;
      var list = [function (done) {
         done();
      }];

      this.push = function (action) {
         if (action.call) {
            list.push(action);
         } else {
            console.warn("util.All, push: function expected");
         }

         return self;
      };

      this.then = function (action) {
         if (action.call) {
            new Promise(function (resolve) {
               var count = 0;
               list.forEach(function (action) {
                  action.call(scope || window, function () {
                     // individual resolve
                     count++;
                     if (count == list.length) {
                        // total resolve
                        resolve();
                     }
                  });
               });
            }).then(function () {
               action.call(scope || window);
            });
         } else {
            console.warn("exports.All, then: function expected");
         }

         return self;
      };

      return self;
   };

   exports.modified = function (path, name) {
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

   exports.localJson = function(path){
      return new Promise(function (resolve, reject) {
         var name = hash(path);
         exports.modified(path, name).then((modified) => {
            if(modified){
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
}

