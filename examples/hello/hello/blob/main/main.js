(function(){return{
   m: function (next) {
      this.modelStr = "Hello";
      next();
   },

   v: function () {
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
    }
  },

   c: function (next) {
      next();
   }
}})()
