// require
const path = require("path");
const klaw = require("klaw");

// local
const util = require("./util");
const build = require("./build");

const ioEvent = function() {
   // this = {
   //    configuration
   //    configurationFilePath
   //    express: {
   //       req
   //       res
   //       next
   //    },
   //    mountType
   //    mountPoint
   //    root
   //    util
   // }

   var script = require(path.resolve(
      this.root,
      this.configuration.script
   ));

   script.call(this, script);
};

const mount = function (klawItem, confDone) {
   // this = {
   //   conf (runtime)
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
         typeHandler = ioEvent;
         mountType = "io";
         break;
      case "socket.json":
         mountType = "socket";
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

            // mount io's and app's
            if(typeHandler && typeHandler.call) {
               this.router.use(
                  "/" + mountType + "/" + mountPoint,
                  function (req, res, next) {
                     typeHandler.call({
                        configuration: configuration,
                        configurationFilePath: configurationFilePath,
                        express: {
                           req: req,
                           res: res,
                           next: next
                        },
                        mountType: mountType,
                        mountPoint: mountPoint,
                        root: path.parse(configurationFilePath).dir,
                        util: util // expose util
                     });
                  }
               );
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

