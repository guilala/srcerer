var Srcerer = require("srcerer");

var srcerer = new Srcerer({
   name: "Another Srcerer",
   port: 2001,
   npm: "/usr/local/lib/node_modules/npm"
});

srcerer.start();
