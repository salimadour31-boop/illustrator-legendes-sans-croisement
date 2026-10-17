// Charge le script hors Illustrator (main() n'est pas lancé car `app` n'existe pas).
var fs = require('fs'), vm = require('vm'), path = require('path');
module.exports = function (globals) {
  var src = fs.readFileSync(path.join(__dirname, '..', 'LegendesSansCroisement.jsx'), 'utf8');
  var ctx = vm.createContext(globals || {});
  vm.runInContext(src + '\n;this.LSC = LSC; this.LSC_UI = LSC_UI;', ctx);
  return ctx;
};
