/*!
* Srcerer, bubbles: client- side for srcerer
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

(function () {
   "use strict";
   var bubbles = {
      // blob graphics require svg capable client
      SvgCapable: !!document.createElementNS && !!document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect,

      // xhr request
      Xhr: function (url, done, post) {
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
      Data: function(url, done, post){
         this.Xhr(url, function(dataStr){
            try {
               done(JSON.parse(dataStr));
            } catch(e) {
               done({
                  error: e
               });
            }
         }, post);
      },

      Add: function () {
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
      Arrayify: function (obj) {
         if (Array.isArray(obj)) {
            return obj;
         } else {
            return [obj];
         }
      },

      // queued promises, then
      Que: function (que, ctx) {
         (function next() {
            var step = que.shift();
            if (step && step.call) {
               new Promise(function (done, reject) {
                  step.call(ctx, done, reject);
               }).then(next);
            } else if (que.length) {
               next();
            }
         })();
      },

      // call async functions simultaneously, finish when they are done
      All: function (context) {
         var self = this;
         var list = [];

         this.add = function(action) {
            if (action && action.call) {
               list.push(action);
            } else {
               console.error("util.all, add: not a function");
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

      ElmApi: [
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
               if(bubbles.SvgCapable && bubbles.ImgCache.hasOwnProperty(this.elm.svg)){
                  this.domElm = bubbles.ImgCache[this.elm.svg].cloneNode(true);
                  this.domElm.removeAttribute("id");
                  this.domElm.classList.add(this.elm.svg);
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

         // id
         {
            name: "id",
            act: function () {
               this.ctx.ref[this.elm.id] = this.e;
               this.ctx.instance[this.elm.id] = this.ctx;
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
               bubbles.Arrayify(this.elm.css).forEach(function (css) {
                  this.domElm.classList.add(css);
               }, this);
            }
         },

         // custom styles
         {
            name: "style",
            act: function () {
               bubbles.Add(this.domElm.style, this.elm.style);
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
               bubbles.Arrayify(this.elm.blob).forEach(function (blobSrc) {
                  if (blobSrc.name) {
                     // inherit
                     var context = bubbles.Add({}, this.ctx, blobSrc);

                     // insert
                     bubbles.Blob(blobSrc.name, this.domElm, context, function (blob) {
                        if(blob.next && blob.next.call) {
                           blob.next.call(context, blob);
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
               bubbles.Elm(this.elm.elm, this.domElm, this.ctx);
            }
         }
         
      ],

      // dom element parser
      Elm: function (elms, tg, ctx) {
         var newElms = [];
         bubbles.Arrayify(elms).forEach(function (elm) {
            var proc = {
               domElm: undefined,
               ctx: ctx,
               elm: elm,
            };

            // prepare type
            if(!elm.tag && !elm.svg) {
               elm.tag = "div";
            }

            // run required extentions
            bubbles.ElmApi.forEach(function(ext){
               if(proc.elm.hasOwnProperty(ext.name)) {
                  ext.act.call(proc);
               }
            });

            if(tg.nodeType === 8 && tg.parentNode) {
               tg.parentNode.insertBefore(proc.domElm, tg);
            } else {
               console.log(elms);
               tg.appendChild(proc.domElm);
            }

            newElms.push(proc);
         });

         return newElms;
      },

      // mvc
      Mvc: function (mvc, mvcDone, inherit) {
         var que = [];
         
         // inheritance 
         var ctx = this.Add(inherit, {
            mvc: mvc
         });

         var rmDom = function(tgs){
            var parent = ctx.dom.nodeType === 8 ? ctx.dom.parentNode : ctx.dom;
            tgs.forEach(function (child) {
               if (child.parentNode === parent){
                  parent.removeChild(child);
               }
            });
         };

         // configure model
         if(mvc.model) que.push(mvc.model);

         // configure view
         if(mvc.view) que.push(function(done){
            mvc.root = this.Elm(mvc.view.call(ctx), mvc.dom, ctx);
            // wrap around destroy
            var destroyer = mvc.destroy;
            mvc.destroy = function(){
               if(mvc.root && mvc.root.length){
                  if (destroyer && destroyer.call) destroyer.call(ctx, function(){
                     rmDom(mvc.root);
                  });
                  else rmDom(mvc.root);
               }
            };
            done();
         });

         // configure controller
         if(mvc.controller) que.push(mvc.controller);

         // configure ready
         if(mvcDone) que.push(mvcDone);

         // start
         this.Que(que, ctx);
      },

      BlobCache: {},

      ImgCache: {},

      Blob: function (name, tg, inherit, done) {
         var ctx = this.Add(
            this,
            {
               ref: {},
               instance: {},
               tg: {}
            }, 
            inherit
         );

         var parse = function (src) {
            var blob = {};
            var head = document.head || document.getElementsByTagName("head")[0];

            // eval
            try {
               blob = eval(src);
            } catch (err) {
               console.error("Blob " + name, err);
            }

            // init css
            if (blob.css) {
               var style = document.createElement("style");
               style.setAttribute("type", "text/css");
               if (style.styleSheet) style.styleSheet.cssText = blob.css;
               else style.appendChild(document.createTextNode(blob.css));
               head.appendChild(style);
            }

            // svg sprite images
            if (blob.svg){
                    var imgs = new DOMParser().parseFromString(blob.svg, "image/svg+xml").getElementsByTagName("svg");
                    var i=0, l=imgs.length; for(i; i<l; i++){
                        var img = imgs[i];
                        if(img.id) bubbles.ImgCache[img.id] = img;
                    }
                }

            // init mvc
            if (blob.mvc && (blob.mvc.model || blob.mvc.view || blob.mvc.controller)) {
               var mvc = Object.create(blob.mvc);
               mvc.dom = tg;
               bubbles.Mvc(mvc, done, bubbles.Add(ctx, {
                  id: ctx.id,
                  dom: tg
               }));
            } else if(done) {
               done.call(ctx, blob);
            }
         };

         // console.log("name", name, bubbles.BlobCache[name], bubbles.BlobCache);
         if (bubbles.BlobCache.hasOwnProperty(name)) {
            bubbles.BlobCache[name].then(parse);
         } else if (window.hasOwnProperty("Promise")){
            bubbles.BlobCache[name] = new Promise(function (pDone) {
               bubbles.Xhr.call(bubbles, "bin/" + name + ".js", function (src) {
                  pDone(src);
                  parse(src);
               });
            });
         } else {
            // without depend on Promise polyfill
            bubbles.Xhr.call(bubbles, "bin/" + name + ".js", function (src) {
               parse(src);
            });
         }
      },

      // acquire polyFills
      Acquire: function (coll, done) {
         var ctx = this, polyFill = 0, isReady = function () {
            if (!polyFill && done) done();
         };

         var newBlob = function(name) {
            polyFill++;
            ctx.Blob(name, false, ctx, function (blob) {
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
      bubbles.Acquire({
         classList: "classList" in document.createElement("a"),
      forEach: Array.prototype.forEach,
         promise: window.Promise
      }, function () {
         bubbles.Blob("main", document.body);
      });
   });
})();

