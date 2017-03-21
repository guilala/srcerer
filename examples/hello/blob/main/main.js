this.model = function (next) {
   this.modelStr = "Hello";
   next();
};

this.view = function () {
   return {
      css: "main",
      elm: [{
      str: this.modelStr,
      elm: [{
            svg: "ic_kettle_24px"
         }, {
            css: "world",
            blob: {
               name: "world"
            }
         }]
      }]
   };
};
 
this.controller = function (next) {
   next();
};

