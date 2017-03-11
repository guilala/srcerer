// require
const path = require("path");
const klaw = require("klaw");

// local
const util = require("./util");
const build = require("./build");

// resolve script and call with conext
const resolveAndCall = function() {
   if(this.context.configuration.script) {
      var scriptPath = path.resolve(
         this.context.root,
         this.context.configuration.script
      );

      try {
         var script = require(scriptPath);
         if(script.call) {
            script.call(this, script);
         } else {
            console.error("\n\n\x1b[31mserver, mountPoints: not a module", scriptPath);
         }
      } catch (err) {
         console.error("\n\n\x1b[31m", err);
      }
   } else {
      console.error(
         "\n\n\x1b[31mserver, mountPoints: script undefined",
         this.context.configurationFilePath
      );
   }
};

const mount = function (klawItem, confDone) {
   // this = {
   //   conf
   //   router (express)
   //   ...
   // }

   const configurationFilePath = klawItem.path;
   // mount point equals configurationFilePath directory name
   const mountPoint = path.dirname(configurationFilePath).split(path.sep).pop();

   var mountType;
   var typeHandler;

   switch(path.basename(configurationFilePath)) {
      case "app.json":
         mountType = "app";
         typeHandler = build;
         break;
      case "io.json":
         mountType = "io";
         typeHandler = resolveAndCall;
         break;
      case "socket.json":
         mountType = "socket";
         break;
      case "extention.json":
         mountType = "extention";
         break;
   }

   // load if mountType is known
   if(mountType !== undefined) {
      util.localJson(
         configurationFilePath
      ).then((configuration) => {
         // if running server is a member of configuration.server
         if(
            configuration.server &&
            configuration.server.indexOf &&
            (
               configuration.server.indexOf(this.conf.name) >= 0 ||
               configuration.server === "*"
            )
         ) {
            // share context
            var context = this.mount[mountType][mountPoint] = {
               configuration: configuration,
               configurationFilePath: configurationFilePath,
               mountType: mountType,
               mountPoint: mountPoint,
               root: path.parse(configurationFilePath).dir,
               util: util // expose util
            };

            // mount io or app
            if(typeHandler && typeHandler.call) {
               var mountPath = "/" + mountType + "/" + mountPoint;
               this.router.use(
                  mountPath,
                  function (req, res, next) {
                     typeHandler.call({
                        context: context,
                        express: {
                           req: req,
                           res: res,
                           next: next
                        }
                     });
                  }
               );
            }

            // mount extention
            else if(mountType === "extention") {
               resolveAndCall.call({
                  context: context,
                  runtime: this
               });
            }

             process.stdout.write("\n\x1b[35m" + mountType + " \x1b[36m" +  mountPoint + "\n");
         } else {
            process.stdout.write("\x1b[35m.");
         }

         confDone();
      }, (err) => {
         console.error(`mountPoints, mount, ${configurationFilePath}: ${err}`);

         confDone();
      });
   } else {
      confDone();
   }
};

// mount app, io and socket modules
module.exports = function(done) {
   const configurationQue = util.all();
   process.stdout.write("\n");

   // list files in root
   klaw(this.conf.root)

   .on("data", (klawItem)=> {
      configurationQue.add((confDone)=> {
         mount.call(this, klawItem, confDone);
      });
   })

   .on("end", ()=> {
      configurationQue.then(()=> {
         process.stdout.write("\n");
         done();
      });
   });
};

