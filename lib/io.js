/*!
 * Srcerer io
 * Copyright(c) 2010-2015 Jesse Tijnagel
 * MIT Licensed
 */

(function(){
   module.exports = function (req, res, next) {
      console.log("io.js");
      res.respond.io = "parsed by io.js";
      next();
   }
}())

