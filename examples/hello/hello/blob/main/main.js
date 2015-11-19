(function(){return{
   m: function (next) {
      this.modelStr = "Hello";
      next();
   },

   v: function () {
    var self = this;
    return {
      str: self.modelStr,
      css: "main"
    }
  },

   c: function (next) {
      next();
   }
}})()
