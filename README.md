# Srcerer
Npm [package](https://www.npmjs.com/package/srcerer) for building and serving light and modular web applications with [Node.js](https://nodejs.org), [MongoDB](https://www.mongodb.com) and [Nginx](http://nginx.org).

## Purpose
Use Srcerer if you can:
- afford to be unconventional about front- end development.
- aggree HTML is not meant to be written manually.
- contribute with functionality and improvements.

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
![helloWorld](url:https://raw.githubusercontent.com/guilala/srcerer/master/examples/hello/hello.png)

## Todo
- feature, convention and api documentation. 
- remove magic from code and functionality.
- remove functionality to get Srcerer barebone.

