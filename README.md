# Srcerer
Npm [package](https://www.npmjs.com/package/srcerer) for building and serving light and modular web applications with [Node.js](https://nodejs.org) and [Nginx](http://nginx.org).

## Purpose
With Srcerer you can build, and / or serve web applications written in vanilla Javascript:
- With a modular Node.Js back- end.
- And a modular client side; say "self-contained web components", or "ShadowDOM" avant la lettre.
- Being lightweight, compatible with conventional browsers, and [webviews](http://developer.telerik.com/featured/what-is-a-webview).

You can also use Srcerer to help:
- Create interfaces controlling a [Raspberrypi](https://www.raspberrypi.org), or any other Node.js capable hardware.
- Build snappy mobile applications.

But only use Srcerer if you:
- Can afford to be unconventional about application development.
- Can aggree HTML is not meant to be written manually.
- Contribute with missing functionality and improvements.
- Favor [fat client](https://en.wikipedia.org/wiki/Fat_client) architectures.

## Application
Srcerer can build multiple applications separately, generating the index and other static files automatically for each app.json file.

## Server
Based on app.json settings and a template, Srcerer automatically creates Nginx configuration files. A simlink inside Nginx's 'sites-enabled', and you are hosting the application.

## Back- end
Srcerer hosts interactivity by using [Express](https://expressjs.com)'s req, res, next api for blobs to send and receive interactive data in JSON format. It automatically mounts the scripts configured in the io.json files it finds.

## Modular client
Srcerer builds each client- side application module by compiling 'blobs' from source directories. A single blob is a collection of minimized files, and can simultaneously serve a model, view, controller, destroyer, css ([Less](http://lesscss.org)), and svg object. None of them mandatory. Svg is used as a transporter to deliver multiple vector, and / or pixel based graphics. In production, blob requests are cached for reuse at client- side.

## Run example
```bash
npm install srcerer
cd node_modules/srcerer/examples/
npm install
node main.js
```
And open in a browser: [localhost:2000/app/hello/](http://localhost:2000/app/hello/)
should look like:

![helloWorld](examples/hello/hello.png)

## Basic client side example
Srcerer provides modularity and inheritance with little convention
```javascript
this.model = function(next, ctx, input) {
   // inherit something from a parent
   ctx.inheritedSomething = input.something;
   ctx.fadeOutFunction = input.fadeOut;

   // define something locally
   ctx.somethingNew = "world";

   // proceed synchronously or asynchronously when model is set
   next();
};

this.view = function(next, elm, ctx) {
   // dom elements
   elm([{
      // div with text node
      dom: "someId",
      str: "Hello " + ctx.somethingNew
   }, {
      // div with strong text node
      elm: [{
         tag: "strong",
         str: ctx.inheritedSomething
      }]
   }]);

   // proceed synchronously or asynchronously when dom elements are created
   next();
};

this.controller = function(next, ctx) {
   // do something with view
   ctx.dom.someId.style.color = "red";

   // proceed synchronously or asynchronously when controller is set up
   next();
};

this.destroy = function(next, ctx) {
   // do something before this context gets destroyed
   ctx.fadeOutFunction(ctx.dom.someId, next);
};
```

## Todo
- Feature, convention and api documentation.
- Make build process extendable to support individual needs like CoffeeScript, TypeScript, etc.

