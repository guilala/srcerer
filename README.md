# Srcerer
Npm [package](https://www.npmjs.com/package/srcerer) for building and serving light and modular web applications with [Node.js](https://nodejs.org), [MongoDB](https://www.mongodb.com) and [Nginx](http://nginx.org).

## Blobs
Srcerer builds blobs from source directories. Blobs are minimized files that can contain a model, view, controller, css, and / or svg graphics. The svg format can deliver multiple vector, and pixel graphics.

## Run example
```bash
npm install srcerer
cd node_modules/srcerer/examples/hello/
npm link ../..
node main.js
```
And open in a browser: [localhost:2001/hello/](http://localhost:2001/hello/)
should look like:
![helloWorld](url:https://www.guila.la/helloWorld.png)
