this.model = function (next, ctx, input) {
   ctx.worldString = input.worldString;

   next();
};

this.view = function (next, setView, ctx) {
   setView({
      str: ctx.worldString,
      css: "world",
      elm: {
         svg: "ic_xilo_24px"
      }
   });

   next();
};

