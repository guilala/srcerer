exports["test srcerer all"] = function(assert, done) {
   var Srcerer = require("../");

   var srcerer = new Srcerer({
      name: "Another Srcerer",
      port: 2001
   });

   assert.strictEqual(typeof(srcerer), "object", "srcerer loaded");
   assert.strictEqual(typeof(srcerer.version), "string", srcerer.version);
   assert.strictEqual(typeof(srcerer.start), "function", "srcerer has start function");

   done();
}

if (module == require.main) require("test").run(exports)
