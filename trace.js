// Live trace of the TrollOpen fan-menu gesture state machine.
var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }
function cls(n) { var p = objc_getClass(mk(n)); return p.isNull() ? null : p; }

var gesture = cls('TOJBClass041');
if (!gesture) { console.log('TOJBClass041 missing'); } else {
  var sel = sel_registerName(mk('TOJBMETHOD081:'));
  var m = class_getInstanceMethod(gesture, sel);
  var imp = method_getImplementation(m);
  var mod = Process.findModuleByAddress(imp);
  console.log('hooking imp in ' + (mod ? mod.name : '?'));

  var stateFn = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
  var boolFn = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
  var stateSel = sel_registerName(mk('state'));
  var trackingSel = sel_registerName(mk('trackingGestureActive'));
  var viewSel = sel_registerName(mk('view'));

  Interceptor.attach(imp, {
    onEnter: function (args) {
      var g = args[1];
      var st = stateFn(g, stateSel);
      if (st === 3 || st === 4 || st === 5) {
        console.log('CB state=' + st + ' tracking=' + boolFn(g, trackingSel));
      } else {
        console.log('CB state=' + st + ' tracking=' + boolFn(g, trackingSel));
      }
      this.g = g;
    }
  });
  console.log('attached to TOJBMETHOD081:');
}
setInterval(function () {}, 1000);
