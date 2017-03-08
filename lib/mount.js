// require
const path = require("path");

// local
const util = require("./util");

module.exports = function (configurationQue, configurationFilePath, handler, mountType) {
   // mount point equals configurationFilePath directory name
   const mountPoint = path.dirname(configurationFilePath).split(path.sep).pop();

   // load configuration
   configurationQue.add(function(confDone){
      // this = {
      //   conf (server)
      //   mount (server)
      //   loadConfigurations (util.all, enableMountPoints)
      //   router (ex[ress)
      //   ...
      // }

      util.localJson(
         configurationFilePath
      ).then((confData) => {
         if(
            confData.server &&
            confData.server.indexOf &&
            (
               confData.server.indexOf(this.conf.name) >= 0 ||
               confData.server === "*"
            )
         ) {
            // store
            var context = this.mount[mountType][mountPoint] = {
               configuration: confData,
               configurationFilePath: configurationFilePath,
               mountType: mountType,
               mountPoint: mountPoint,
               root: path.parse(configurationFilePath).dir,
               util: util // expose util
            };

            // mount io's and app's
            if(mountType !== "socket") {
               this.router.use(
                  "/" + mountType + "/" + mountPoint,
                  function (req, res, next) {
                     handler.call({
                        configuration: confData,
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

            console.log("\x1b[35m%s \x1b[36m%s", mountType, mountPoint);
         }

         confDone();
      }, (err) => {
         console.error(`loadIoConfiguration, ${configurationFilePath}: ${err}`);
         confDone();
      });
   });
};

