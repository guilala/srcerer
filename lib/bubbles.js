/*!
* Srcerer, bubbles: client- side for srcerer
* Copyright(c) 2010-2017 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

(function(){
   "use strict";
   var bubbles = {
      // blob graphics require svg capable client
      svgCapable: !!document.createElementNS && !!document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect,

      // xhr request
      xhr: function(url, done, post) {
         var ctx = this, req = new XMLHttpRequest() || new ActiveXObject("Microsoft.XMLHTTP");
         req.onreadystatechange = function () {
            if(req.readyState === 4) {
               done.call(ctx, req.responseText);
            }
         };

         if (post) {
            post = JSON.stringify(post);
            req.open("POST", url, true);
            req.setRequestHeader("Content-type", "application/json");
         } else {
            req.open("GET", url, true);
         }

         req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
         req.send(post || "");
      },

      // xhr request for json data
      data: function(url, done, post){
         bubbles.xhr(url, function(dataStr){
            try {
               done(JSON.parse(dataStr));
            } catch(e) {
               done({
                  error: e
               });
            }
         }, post);
      },

      add: function () {
         var org = arguments[0];
         for(var t=1; t<arguments.length; t++){
            var add = arguments[t];
            for(var k in add) if(add.hasOwnProperty(k)) {
               org[k] = add[k];
            }
         }
         return org;
      },

      // wrap array when isn't array
      arrayify: function (obj) {
         if (Array.isArray(obj)) {
            return obj;
         } else {
            return [obj];
         }
      },

      // call async functions sequentially, finish when they are done
      que: function (context) {
         var self = this;
         var row = [];

         var next = function() {
            if (row.length) {
               new Promise(function(resolve, reject) {
                  row.shift().call(context || self, resolve, reject);
               }).then(next);
            }
         };

         this.add = function(step) {
            if (step && step.call) {
               row.push(step);
            } else {
               console.error("bubbles.que, add: step not a function", step);
            }

            return self;
         };

         this.then = function(action) {
            self.add(action);
            next();

            return self;
         };

         return self;
      },

      // call async functions simultaneously, finish when they are done
      all: function (context) {
         var self = this;
         var list = [];

         this.add = function(action) {
            if (action && action.call) {
               list.push(action);
            } else {
               console.error("bubbles.all, add: action not a function", action);
            }

            return self;
         };

         this.then = function(finalAction) {
            new Promise(function(resolve) {
               var count = list.length;
               if(count) {
                  list.forEach(function(action) {
                     action.call(context || self, function() {
                        // individual resolve
                        count--;
                        // total resolve
                        if (count === 0) {
                           resolve();
                        }
                     });
                  });
               } else resolve();
            }).then(function() {
               if(finalAction && finalAction.call) {
                  finalAction.call(context || self);
               }
            });

            return self;
         };

         return self;
      },

      elmApi: [
         // dom target
         {
            name: "tg",
            act: function () {
               this.domElm = document.createComment(this.elm.tg);
               this.ctx.tg[this.elm.tg] = this.domElm;
            }
         },

         // svg
         {
            name: "svg",
            act: function () {
               if(bubbles.svgCapable && bubbles.imgCache.hasOwnProperty(this.elm.svg)){
                  this.domElm = bubbles.imgCache[this.elm.svg].cloneNode(true);
                  this.domElm.removeAttribute("id");
                  var className = this.domElm.getAttribute("class");
                  this.domElm.setAttribute("class", className + " " + this.elm.svg);
               } else {
                  console.error("Sprite", this.elm.svg);
                  return;
               }
            }
         },

         // tag
         {
            name: "tag",
            act: function () {
               this.domElm = document.createElement(this.elm.tag);
            }
         },

         // ref
         {
            name: "dom",
            act: function () {
               this.ctx.dom[this.elm.dom] = this.domElm;
            }
         },

         // str
         {
            name: "str",
            act: function () {
               this.domElm.classList.add("pre");
               this.domElm.appendChild(document.createTextNode(this.elm.str));
            }
         },

         // html
         {
            name: "html",
            act: function () {
               this.domElm.innerHTML = this.ctx[this.elm.html];
            }
         },

         // css class names
         {
            name: "css",
            act: function () {
               bubbles.arrayify(this.elm.css).forEach(function (css) {
                  this.domElm.classList.add(css);
               }, this);
            }
         },

         // custom styles
         {
            name: "style",
            act: function () {
               bubbles.add(this.domElm.style, this.elm.style);
            }
         },

         // custom attributes
         {
            name: "att",
            act: function () {
               for (var key in this.elm.att) {
                  this.domElm.setAttribute(key, this.elm.att[key]);
               }
            }
         },

         // child blob
         {
            name: "blob",
            act: function () {
               bubbles.arrayify(this.elm.blob).forEach(function (blobSrc) {
                  if(blobSrc.name) {
                     // new order target
                     var orderTarget = bubbles.elm({tg: blobSrc.name}, this.domElm, this.ctx);

                     // load blob
                     bubbles.blob(blobSrc.name, orderTarget[0].domElm, blobSrc, function (ctx) {
                        if(blobSrc.ready && blobSrc.ready.call) {
                           blobSrc.ready.call(ctx, blobSrc);
                        }
                     });
                  }
               }, this);
            }
         },

         // child elm
         {
            name: "elm",
            act: function () {
               bubbles.elm(this.elm.elm, this.domElm, this.ctx);
            }
         }
      ],

      // dom element parser
      elm: function (elms, tg, ctx) {
         var newElms = [];
         bubbles.arrayify(elms).forEach(function (elm) {
            var proc = {
               domElm: undefined,
               ctx: ctx,
               elm: elm,
            };

            // prepare type
            if(!elm.tg && !elm.svg && !elm.tag) {
               elm.tag = "div";
            }

            // run all elm api
            bubbles.elmApi.forEach(function(elmApi){
               if(proc.elm.hasOwnProperty(elmApi.name)) {
                  elmApi.act.call(proc);
               }
            });

            // append to parent
            if(tg.nodeType === 8 && tg.parentNode) {
               tg.parentNode.insertBefore(proc.domElm, tg);
            } else {
               tg.appendChild(proc.domElm);
            }

            newElms.push(proc);
         });

         return newElms;
      },

      // mvc
      mvc: function(tg, mvc, inherit, ready) {
         // inheritance
         var ctx = {
            bubbles: bubbles,
            mvc: mvc,
            tg: {},
            dom: {}
         };

         var que = new bubbles.que(ctx);

         // configure model
         if(mvc.model && mvc.model.call) {
            que.add(function(next){
               mvc.model.call(
                  this,
                  next,
                  ctx,
                  inherit
               );
            });
         }

         // configure view
         var viewDom;
         if(mvc.view && mvc.view.call) {
            que.add(function(next){
               // create view dom
               mvc.view.call(
                  this,
                  next,
                  function(viewElm){
                     viewDom = bubbles.elm(viewElm, tg, ctx);
                  },
                  ctx
               );
            });
         }

         // configure controller
         if(mvc.controller && mvc.controller.call) {
            que.add(function(next){
               mvc.controller.call(
                  this,
                  next,
                  ctx
               );
            });
         }

         // configure destroyer
         var removeViewDom = function(){
            if(viewDom && viewDom.length) {
               var parent = tg.nodeType === 8 ? tg.parentNode : tg;
               viewDom.forEach(function (child) {
                  if (child.domElm.parentNode === parent){
                     parent.removeChild(child.domElm);
                  }
               });
            }
         };

         var customDestroyer = mvc.destroy;
         mvc.destroy = function(){
            if (customDestroyer && customDestroyer.call) {
               customDestroyer.call(
                  this,
                  removeViewDom,
                  ctx
               );
            } else {
               removeViewDom();
            }
         };

         // run model, then view, then controler, then call back
         que.then(function(){
             if(ready && ready.call) ready.call(ctx);
         });
      },

      loadBinScript: function(name) {
         var elm = document.createElement("script");
         var url = "./bin/" + name + ".js";
         var resolver;

         if(!window.bubbleSet) window.bubbleSet = {};

         window.bubbleSet[name] = function(construct) {
            resolver(construct);
            delete window.bubbleSet[name];
            document.head.removeChild(elm);
         };

         return new Promise(function(resolve, reject) {
            resolver = resolve;

            elm.setAttribute("src", url);
            elm.setAttribute("type", "text/javascript");
            elm.setAttribute("charset", "utf-8");
            elm.setAttributeNode(document.createAttribute("async"));

            elm.onerror = function(evt) {
               reject("Error while loading: " + url);
            };

            document.head.appendChild(elm);
         });
      },

      blobCache: {},

      svgCache: {},

      cssCache: {},

      imgCache: {},

      blob: function(name, tg, ctx, ready) {
         var parse = function (mvcContext) {
            var blob = new bubbles.all(new mvcContext());

            // css
            blob.add(function(ready){
               if(this.css && bubbles.cssCache[name] !== true) {
                  var style = document.createElement("link");
                  style.setAttribute("rel", "stylesheet");
                  style.setAttribute("href", "bin/" + name + ".css");
                  style.onload = function(){
                     bubbles.cssCache[name] = true;
                     ready();
                  };
                  document.head.appendChild(style);
               } else {
                  ready();
               }
            });

            // svg sprite
            blob.add(function(ready){
               if(this.svg && bubbles.svgCache[name] !== true) {
                  bubbles.xhr("bin/" + name + ".svg", function(svgData){
                     var imgs = new DOMParser().parseFromString(svgData, "image/svg+xml").getElementsByTagName("svg");
                     for(var i = 0; i < imgs.length; i++){
                        var img = imgs[i];
                        if(img.id) bubbles.imgCache[img.id] = img;
                     }
                     bubbles.svgCache[name] = true;
                     ready();
                  });
               } else {
                  ready();
               }
            });

            blob.then(function(){
               // init mvc
               if (this.model || this.view || this.controller) {
                  this.name = name;
                  bubbles.mvc(tg, this, ctx, ready);
               } else if(ready && ready.call) {
                  ready.call(this);
               }
            });
         };

         // console.log("name", name, bubbles.blobCache[name], bubbles.blobCache);
         if (!bubbles.blobCache.hasOwnProperty(name)) {
            bubbles.blobCache[name] = bubbles.loadBinScript(name, ctx);
         }

         bubbles.blobCache[name].then(parse, function(err){
            console.log(err);
            ready();
         });
      },

      // acquire polyFills
      acquire: function (coll, done) {
         var ctx = this, polyFill = 0, isReady = function () {
            if (!polyFill && done) done();
         };

         var newBlob = function(name) {
            polyFill++;
            ctx.blob(name, false, ctx, function (blob) {
               coll[name] = blob;
               polyFill--;
               isReady();
            });
         };

         for (var name in coll) {
            if (coll.hasOwnProperty(name) && !coll[name]) {
               newBlob(name);
            }
         }
         isReady();
      },
   };

   // the chicken or the egg
   window.addEventListener("load", function(){
      // polyfill missing dependencies
      bubbles.acquire({
         classList: "classList" in document.createElement("a"),
         forEach: Array.prototype.forEach,
         promise: window.Promise
      }, function () {
         bubbles.blob("main", document.body, {
            bubbles: bubbles
         });
      });
   });
})();

