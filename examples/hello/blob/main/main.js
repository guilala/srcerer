this.model = function (next, ctx, input) {
   ctx.helloString = "Hello";
   ctx.worldString = "world";

   next();
};

this.view = function (next, setView, ctx) {
   setView({
      css: "main",
      elm: [{
      str: ctx.helloString,
      elm: [{
            svg: "ic_kettle_24px"
         }, {
            css: "world",
            blob: {
               name: "world",
               worldString: ctx.worldString
            }
         }]
      }]
   });

   next();
};
 
this.controller = function (next, ctx) {
   next();
};

