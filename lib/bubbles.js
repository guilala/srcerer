/*!
* Srcerer, bubbles: client- side for srcerer
* Copyright(c) 2010-2016 Jesse Tijnagel (Guilala)
* MIT Licensed
*/

(function () {
   "use strict";
   var bubbles = {
      // blob graphics require svg capable client
      svgCapable: !!document.createElementNS && !!document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect,

      // xhr request
      xhr: function (url, done, post) {
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

      walk: function(src, path, act){
			path.split(".").forEach(function(next){
				if(src !== path && src.hasOwnProperty(next)) src = src[next];
				else src = path;
			});

			if(src !== path) {
			   bubbles.arrayify(src).forEach(act);
			}
		},

      // queued promises, then
      que: function (que, ctx) {
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
      all: function (context) {
         var self = this;
         var list = [];

         this.add = function(action) {
            if (action && action.call) {
               list.push(action);
            } else {
               console.error("util.all, add: not a function", action);
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
               this.ctx.ref[this.elm.id] = this.domElm;
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
                  if (blobSrc.name) {
                     // inherit
                     var context = bubbles.add({}, this.ctx, blobSrc);

                     // insert
                     bubbles.blob(blobSrc.name, this.domElm, context, function (blob) {
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
            if(!elm.tag && !elm.svg) {
               elm.tag = "div";
            }

            // run required extentions
            bubbles.elmApi.forEach(function(ext){
               if(proc.elm.hasOwnProperty(ext.name)) {
                  ext.act.call(proc);
               }
            });

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
      mvc: function (mvc, mvcDone, inherit) {
         var que = [];
         
         // inheritance 
         var ctx = bubbles.add(
            inherit,
            {
               bubbles: bubbles,
               mvc: mvc
            }
         );

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
            mvc.root = bubbles.elm(mvc.view.call(ctx), mvc.dom, ctx);
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
         bubbles.que(que, ctx);
      },

      blobCache: {},

      imgCache: {},

      blob: function (name, tg, inherit, done) {
         var ctx = bubbles.add(
            {
               name: name,
               bubbles: bubbles,
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
                        if(img.id) bubbles.imgCache[img.id] = img;
                    }
                }

            // init mvc
            if (blob.mvc && (blob.mvc.model || blob.mvc.view || blob.mvc.controller)) {
               var mvc = Object.create(blob.mvc);
               mvc.dom = tg;
               bubbles.mvc(mvc, done, bubbles.add(ctx, {
                  id: ctx.id,
                  dom: tg
               }));
            } else if(done) {
               done.call(ctx, blob);
            }
         };

         // console.log("name", name, bubbles.blobCache[name], bubbles.blobCache);
         if (bubbles.blobCache.hasOwnProperty(name)) {
            bubbles.blobCache[name].then(parse);
         } else if (window.hasOwnProperty("Promise")){
            bubbles.blobCache[name] = new Promise(function (pDone) {
               bubbles.xhr.call(bubbles, "bin/" + name + ".js", function (src) {
                  pDone(src);
                  parse(src);
               });
            });
         } else {
            // without depend on Promise polyfill
            bubbles.xhr.call(bubbles, "bin/" + name + ".js", function (src) {
               parse(src);
            });
         }
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

