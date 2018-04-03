0.15.3 / 2018-04-03
===================
* Fix modified style sheet compression errors. 

0.15.2 / 2018-04-03
===================
* Write app index file just once, since source and compiled versions are equal.

0.15.1 / 2018-03-16
===================
* Make exterior assets available in debug mode by mounting static www after mounting static source.
* Log Srcerer package version of Express and WS.

0.15.0 / 2018-03-09
===================
* Breaking: keep generated source separated from compiled source.

0.14.5 / 2017-12-20
===================
* Adapt to new svgo syntax.

0.14.4 / 2017-09-24
===================
* Readme client side example.

0.14.3 / 2017-08-29
===================
* Compatibility, discard ansi color output.
* Bump express, klaw, uglify-js.

0.14.2 / 2017-08-01
===================
* Use uglify-js3.
* Upgrade ws to 3.1.0.

0.14.1 / 2017-07-13
===================
* Call custom destroyers with context.
* Always create destroyer; also when there is no view.
* mountPoints: log version number and relative path.
* Don't use package-lock.json file.

0.14.0 / 2017-06-30
===================
* Add healthcheck functionality.
* Use package-lock.json file.

0.13.1 / 2017-06-15
===================
* Error handling for socket connections.

0.13.0 / 2017-04-25
===================
* Breaking: asynchronous views.
* Breaking: isolate context.

0.12.1 / 2017-04-13
===================
* Add svg and css file cache indicators.
* Fix context of mvcDone callback function.

0.12.0 / 2017-03-21
===================
* Breaking: Content Security Policy: remove inline script and stylesheet options.
* CSP, blob: load MVC Javascript using header script tags, and drop use of 'eval'.
* CSP, blob: load SVG and CSS data from separate files, using corresponding file type.

0.11.0 / 2017-03-11
===================
* Server, mountPoints: new option to add server extentions.
* Breaking, server: drop favicon and session support, use extentions instead.
* Reduce dependencies from 200 to 148 modules.

0.10.1 / 2017-03-10
===================
* build: add option for custom header tags, such as 'link' for favicon.

0.10.0 / 2017-03-09
===================
* Breaking, permissions: enable io's, apps and sockets in their configuration file, based on server names.
* Performance: preload io, app and socket configuration files.

0.9.0 / 2017-03-03
===================
* Breaking: make nginx template parsing generic.

0.8.12 / 2017-02-11
===================
* Bubbles, Internet Explorer workaround: IE11 supports classList, but not on SVG elements.

0.8.11 / 2017-02-07
===================
* Drop fs-extra in favour of klaw

0.8.10 / 2017-01-12
===================
* Isolate runtime to allow multiple server instances

0.8.9 / 2016-10-13
===================
* Improved websocket performance
* Use strict mode

0.8.8 / 2016-10-05
===================
* New app configuration syntax for blobs.
* Parse paths for app configuration blobs.
* Fix debug mode switching, configureBlobs loop.

0.8.7 / 2016-09-28
===================
* Add util.parsePaths, including untildify.
* Untildify nginx conf.

0.8.6 / 2016-09-27
===================
* Expose utils to io's and sockets.

0.8.5 / 2016-09-20
===================
* Use 'script' property for file names of io's and sockets.

0.8.4 / 2016-09-15
===================
* Use untildify for ngix conf paths.

0.8.3 / 2016-09-09
===================
 * Enable web socket mounting functionality.

0.8.2 / 2016-08-19
===================
 * Breaking changes client- side:
 * bubbles: remove bloat, make elm types extendable.
 * bubbles: wrap bubbles in 'bubbles' obj for better inheritance.
 * bubbles: use lower camel case.

0.7.7 / 2016-08-11
===================
 * Update comment headers.

0.7.6 / 2016-08-11
===================
 * build: recreate index after switching debug mode.
 * io: enable io script mounting.
 * build: only build index if appConf is modified.

0.7.2 / 2016-07-27
===================
 * Fix bubbles.js destroy function.

0.7.1 / 2016-07-27
===================
 * Refactor code of server.js and build.js.
 * Improve app configuration file keys en values.
 * Improve mvc markup: less overhead, compatible with jshint.
 * Adapt hello demo to changes.

0.6.2 / 2015-11-05
===================
 * Use global npm.

0.6.1 / 2015-11-05
===================
 * Setup as npm package.

0.6.0 / 2015-11-05
===================
 * Make Srcerer MIT open source.
 * Publish on Github.

