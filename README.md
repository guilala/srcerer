# Srcerer
Npm [package](https://www.npmjs.com/package/srcerer) for building and serving light and modular web applications with [Node.js](https://nodejs.org) and [Nginx](http://nginx.org).

## Purpose
With Srcerer you can build, and / or serve web applications:
- With a modular Node.Js back- end.
- Whith a modular client side; say "self-contained web components", or "ShadowDOM".
- Beeing lightweight, compatible with conventional browsers, and [webviews](http://developer.telerik.com/featured/what-is-a-webview).

Use Srcerer if you can:
- afford to be unconventional about cross platform front- end development.
- aggree HTML is not meant to be written manually.
- contribute with functionality and improvements.

## Apps
Srcerer builds applications, and automatically creates nginx files for Nginx to host them.

## Blobs
Srcerer builds each application by compiling 'blobs' from source directories. Blobs are minimized bytary files that can contain a model, view, controller, destroyer, css ([Less](http://lesscss.org)), and svg object. None of them required. The svg format delivers multiple vector, and / or pixel based graphics.

## IO's
Srcerer hosts interactivity by using [Express](https://expressjs.com)'s req, res, next api for blobs to send and receive interactive data in JSON format. 

## Dependencies
- nodeJs >= 4.0.0
- nginx
- dependencies in package.json

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
- feature, convention and api documentation. 
- remove functionality to get Srcerer barebone.

