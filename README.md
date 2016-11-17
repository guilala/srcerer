# Srcerer
Npm [package](https://www.npmjs.com/package/srcerer) for building and serving light and modular web applications with [Node.js](https://nodejs.org) and [Nginx](http://nginx.org).

## Purpose
With Srcerer you can build, and / or serve web applications:
- With a modular Node.Js back- end.
- With a modular client side; say "self-contained web components", or "ShadowDOM"; called 'blob'.
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
Srcerer can build mutliple applications separately, generating the index, and other static files automatically based on any app.json file it finds.

## Server
Based on app.json settings and a template, Srcerer can automatically create nginx configuration files. A simlink inside Nginx's 'sites-enabled', and you are hosting the application.

## Back- end
Srcerer hosts interactivity by using [Express](https://expressjs.com)'s req, res, next api for blobs to send and receive interactive data in JSON format. It mounts scripts configured in any io.json it finds.

## Modular client
Srcerer builds each client- side application module by compiling 'blobs' from source directories. Blobs are minimized bytary files that can contain a model, view, controller, destroyer, css ([Less](http://lesscss.org)), and svg object. None of them required. The svg format delivers multiple vector, and / or pixel based graphics.

## Dependencies
- nodeJs >= 6.9.1
- See dependencies in package.json

## Run example
```bash
npm install srcerer
cd node_modules/srcerer/examples/
npm i
node main.js
```
And open in a browser: [localhost:2000/hello/](http://localhost:2000/hello/)
should look like:

![helloWorld](examples/hello/hello.png)

## Todo
- Feature, convention and api documentation. 
- Make build process extendable.

