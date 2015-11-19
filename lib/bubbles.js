/*!
 * Srcerer: bubbles.js
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */
(function () {
   "use strict";
   return {
      Touch: !!("ontouchstart" in window || navigator.msMaxTouchPoints),

      Svg: !!document.createElementNS && !!document.createElementNS("http://www.w3.org/2000/svg", "svg").createSVGRect,

      // xhr request
      Xhr: function (url, done, post) {
         var ctx = this, req = new XMLHttpRequest() || new ActiveXObject("Microsoft.XMLHTTP");
         req.onreadystatechange = function () {
            req.readyState === 4 && done.call(ctx, req.responseText);
         };

         if (post) {
            req.open("POST", url, true);
            req.setRequestHeader("X-Requested-With", "XMLHttpRequest");
            req.setRequestHeader("Content-type", "application/json");
         } else {
            req.open("GET", url, true);
         }

         if(post) post = JSON.stringify(post);

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

      FullScreen: function (Do, ctx) {
         ctx = ctx || {};
         var doc = document.documentElement, getState = function(){
            return document.fullscreen || document.mozFullScreen || document.webkitIsFullScreen || document.msFullscreenElement || false;
         };

         var enter = doc.requestFullscreen ||
            doc.mozRequestFullScreen ||
            doc.webkitRequestFullscreen ||
            doc.webkitRequestFullscreen ||
            doc.msRequestFullscreen ||
            false;

         var exit = document.exitFullscreen ||
            document.mozCancelFullScreen ||
            document.webkitCancelFullScreen ||
            document.msExitFullscreen ||
            false;

         if(enter) {
            ctx = this.Add(ctx, {
               state: getState(),
               toggle: function(state){
                  if (state) enter.call(doc);
                  else exit.call(document);
               }
            });

            this.On(document, ["webkitfullscreenchange", "mozfullscreenchange", "fullscreenchange"], function(){
               ctx.state = getState();
               Do.call(ctx);
            });
         }

         return ctx;
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

      // repeating resolver promise
      Future: function (ctx) {
         ctx = ctx || this;
         var that = this, then = [];
         that.result = undefined;

         this.resolve = function(newResult) {
            that.result = newResult;
            then.forEach(function (then) {
               then.call(ctx, that.result);
            });
         };

         this.clear = function(){
            that.result = undefined;
            then = [];
         };

         this.then = function(newThen){
            if(that.result) newThen.call(ctx, that.result);
            then.push(newThen);
            return that;
         };
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

      // simultaneous promises, then
      All: function (list, ctx) {
         this.then = function (action) {
            list.push(function (done) {
               done();
            });
            new Promise(function (done) {
               var count = 0;
               list.forEach(function (action) {
                  action.call(ctx, function () {
                     // individual done
                     count++;
                     if (count == list.length) {
                        // total done
                        done();
                     }
                  });
               });
            }).then(function () {
               action.call(ctx);
            });
         };
      },

      // event listener
      On: function (tg, To, Do, ctx) {
         if (!Array.isArray(To)) To = [To];
         var ctx = ctx || {}, which = [], call = function (e) {
            ctx.event = e;
            ctx.elm = tg;
            Do.call(ctx);
         }, map = {
            start: [
               "mousedown",
               "touchstart"
            ], move: [
               "mousemove",
               "touchmove"
            ], end: [
               ["mouseup", "mouseout"],
               ["touchend", "touchcancel"]
            ]
         };

         To.forEach(function (to) {
            if (map.hasOwnProperty(to)) to = map[to];
            if (!Array.isArray(to)) to = [to];
            which = which.concat(to);
         });

         which.forEach(function (to) {
            tg.addEventListener(to, call, true);
         });

         return {
            cancel: function () {
               which.forEach(function (to) {
                  tg.removeEventListener(to, call);
               });
            }
         };
      },

      // expect function when needed
      Expect: function(ctx, name){
         return function(){
            if(ctx.hasOwnProperty(name)) ctx[name].apply(this, arguments);
         };
      },

      // find object in path, and apply
      Walk: function(src, path, Do){
         var steps = path.split(".");
         steps.forEach(function(next){
            if(src !== path && src.hasOwnProperty(next)) src = src[next];
            else src = path;
         });

         if(src !== path && Do && Do.call) {
            if (!Array.isArray(src)) src = [src];
            src.forEach(Do);
         }
      },

      Try: function(fun){
         if(fun && fun.call) fun();
      },

      // dom parser
      Elm: function (elm, tg, ctx) {
         var Ssr = this, parse = function (elm, altTg) {
            var e; try {

               // dom position target
               if (elm.tg) {
                  e = document.createComment(elm.tg);
                  ctx.tg[elm.tg] = e;
               }

               // svg
               else if (elm.svg){
                  if(Ssr.Svg && Ssr.Img.hasOwnProperty(elm.svg)){
                     e = Ssr.Img[elm.svg].cloneNode(true);
                     e.removeAttribute("id");
                     e.classList.add(elm.svg);
                  } else {
                     console.error("Sprite", elm.svg);
                     return;
                  }
               }

               else e = document.createElement(elm.tag || "div");

               elm.id && (ctx.ref[elm.id] = e) && (ctx.instance[elm.id] = ctx);

               elm.str && (e.classList.add("pre"), e.appendChild(document.createTextNode(elm.str)));

               elm.html && (e.innerHTML = ctx[elm.html]);

               elm.bg && (e.style.backgroundImage = "url('" + elm.bg + "')");

               elm.style && Ssr.Add(e.style, elm.style);

               if (elm.css) {
                  if (!Array.isArray(elm.css)) elm.css = [elm.css];
                  elm.css.forEach(function (css) {
                     e.classList.add(css);
                  });
               }

               if (elm.att) for (var a in elm.att) e.setAttribute(a, elm.att[a]);

               if (elm.on) {
                  if (!Array.isArray(elm.on)) elm.on = [elm.on];
                  elm.on.forEach(function (on) {
                     on.listener = Ssr.On(e, on.To, on.Do, ctx);
                  });
               }

               if (elm.blob) {
                  if (!Array.isArray(elm.blob)) elm.blob = [elm.blob];
                  elm.blob.forEach(function (blobSrc) {
                     if (blobSrc.name) {
                        var context = Ssr.Add({}, ctx, blobSrc);
                        Ssr.Blob(blobSrc.name, e, context, function (blob) {
                           blob.next && blob.next.call && blob.next.call(context, blob);
                        });
                     }
                  });
               }

               if (elm.future) {
                  var tgl = function(state){
                     e.style.display = state ? "" : "none";
                  };
                  tgl(false);
                  ctx[elm.future] = new Ssr.Future(ctx);
                  ctx[elm.future].then(tgl);
               }

               elm.elm && Ssr.Elm(elm.elm, e, ctx);

               tg.nodeType === 8 && tg.parentNode ? tg.parentNode.insertBefore(e, tg) : tg.appendChild(e);
            } catch (e) {
               console.warn("elm", e);
            }
            return e;
         }, badge = function (elms) {
            var res = [];
            elms.forEach(function (elm) {
               res.push(parse(elm));
            });
            return res;
         };

         return elm.forEach ? badge(elm) : [parse(elm)];
      },

      // handle async mvc
      Mvc: function (mvc, mvcDone, inherit) {
         // Mvc expects ctx.dom parent
         var ctx = this.Add(inherit, {
            mvc: mvc
         }), que = [], rmDom = function(tgs){
            var parent = ctx.dom.nodeType === 8 ? ctx.dom.parentNode : ctx.dom;
            tgs.forEach(function (child) {
               if (child.parentNode === parent){
                  parent.removeChild(child);
               }
            });
         };

         // configure model
         if(mvc.m) que.push(mvc.m);

         // configure view
         if(mvc.v) que.push(function(done){
            mvc.root = this.Elm(mvc.v.call(ctx), ctx.dom, ctx);
            mvc.destroy = function(){
               if(mvc.root && mvc.root.length){
                  if (mvc.d) mvc.d.call(ctx, function(){
                     rmDom(mvc.root);
                  });
                  else rmDom(mvc.root);
               }
            };
            done();
         });

         // configure controller
         if(mvc.c) que.push(mvc.c);

         // configure ready
         if(mvcDone) que.push(mvcDone);

         // start
         this.Que(que, ctx);
      },

      // handle blobs
      BlobCache: {},
        Img: {},
      Blob: function (name, tg, inherit, done) {
            var Ssr = this, ctx = this.Add({
                ref: {},
               instance: {},
               tg: {}
            }, this, inherit), parse = function (src) {
            var blob = {}, head = document.head || document.getElementsByTagName("head")[0];

            // eval
            try {
               blob = eval(src);
            } catch (e) {
               console.error("Blob", e);
            }

            // init css
            if (blob.s) {
               var style = document.createElement("style");
               style.setAttribute("type", "text/css");
               if (style.styleSheet) style.styleSheet.cssText = blob.s;
               else style.appendChild(document.createTextNode(blob.s));
               head.appendChild(style);
            }

            // svg sprite images
            if (blob.i){
                    var imgs = new DOMParser().parseFromString(blob.i, "image/svg+xml").getElementsByTagName("svg");
                    var i=0, l=imgs.length; for(i; i<l; i++){
                        var img = imgs[i];
                        if(img.id) Ssr.Img[img.id] = img;
                    }
                }

            // init mvc
            if (blob.m && (blob.m.m || blob.m.v || blob.m.c)) {
               var mvc = eval(blob.m);
               mvc.dom = tg;
               Ssr.Mvc(mvc, done, Ssr.Add(ctx, {
                  id: ctx.id,
                  dom: tg
               }));
            } else {
               done && done.call(ctx, blob);
            }
         };

         // console.log("name", name, Ssr.BlobCache[name], Ssr.BlobCache);
         if (Ssr.BlobCache.hasOwnProperty(name)) {
            Ssr.BlobCache[name].then(parse);
         } else if (window.hasOwnProperty("Promise")){
            Ssr.BlobCache[name] = new Promise(function (pDone) {
               Ssr.Xhr.call(Ssr, "bin/" + name + ".js", function (src) {
                  pDone(src);
                  parse(src);
               });
            });
         } else {
                // without depend on Promise polyfill
                Ssr.Xhr.call(Ssr, "bin/" + name + ".js", function (src) {
                    parse(src);
                });
            }
      },

      // acquire polyFills
      Acquire: function (coll, done) {
         var ctx = this, polyFill = 0, isReady = function () {
            if (!polyFill && done) done();
         };

         for (var name in coll) {
            if (coll.hasOwnProperty(name) && !coll[name]) {
               (function () {
                  var key = name;
                  polyFill++;
                  ctx.Blob(name, false, ctx, function (blob) {
                     coll[key] = blob;
                     polyFill--;
                     isReady();
                  });
               })();
            }
         }
         isReady();
      },

      Egg: function () {
         var Ssr = this;
         window.onload = function () {
                Ssr.Acquire({
                    classList: "classList" in document.createElement("a"),
               forEach: Array.prototype.forEach,
                    promise: window.Promise
            }, function () {
                    Ssr.Blob("main", document.body);
            });
         };
      }
   }.Egg();
})();
