this.model = function (next) {
   this.modelStr = "Hello";
   next();
};

this.view = function () {
   var self = this;
   return {
      css: "main",
      elm: [{
      str: self.modelStr,
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

