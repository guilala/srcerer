/*!
 * Srcerer
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

if(module.parent) {
   var fs = require("fs-extra");
   var hash = require("string-hash");
   var mTime = {};

   exports.obj = {
      members: function (x, p) {
         for (p in x) return true;
         return false;
      },

      length: function (obj) {
         if (typeof obj == "object") return Object.keys(obj).length;
      },

      merge: function (o1, o2) {
         for (var i in o2) o1[i] = o2[i];
         return o1;
      },

      mergeTo: function (o1, o2) {
         var result = {};
         for (var i in o1) result[i] = o1[i];
         for (var i in o2) result[i] = o2[i];
         return result;
      }
   };

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

   // calls everyone after eachother
   exports.Que = function (scope) {
      var row = [], next = function () {
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
      };
      this.then = function(action){
         if(action) row.push(action);
         next();
      };
   };

   // calls everyone and waits till all finished
   exports.All = function (scope) {
      var list = [function (done) {
         done();
      }];

      this.push = function (action) {
         if (action.call) {
            list.push(action);
         } else {
            console.warn("util.All, push: function expected");
         }
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
      };
   };

   exports.modified = function (path, done) {
      var exists = false, que = new this.Que(this);

      // exists
      que.push(function (resolve) {
         fs.exists(path, function (result) {
            // console.log("issie %s %s", path, result);
            if (result) {
               exists = true;
            }
            resolve();
         });
      });

      // modification
      que.push(function (resolve) {
         if (exists) {
            fs.stat(path, function (err, stats) {
               var modified, id = hash(path), latest = new Date(stats.mtime).getTime();
               //console.log("compare", latest, mTime[id]);
               if (mTime.hasOwnProperty(id) && latest <= mTime[id]) {
                  modified = false;
               } else {
                  modified = latest;
               }
               mTime[id] = latest;
               done && done.call(this, modified);
            });
         } else {
            done && done.call(this, undefined);
         }
         resolve();
      });
      que.then();
   };

   var jsonLoaded = {};
   exports.localJson = function(path){
      return new Promise(function (resolve, reject) {
         exports.modified(path, function(isModified){
            var id = hash(path);
            if(isModified){
               fs.readJson(path, function (err, jsonData) {
                  if(err) reject(err);
                  else {
                     jsonLoaded[id] = jsonData;
                     resolve(jsonLoaded[id]);
                  }
               });
            } else {
               resolve(jsonLoaded[id]);
            }
         });
      });
   };
}
