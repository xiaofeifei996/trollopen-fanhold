var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var msgLong = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var msgDouble = new NativeFunction(objc_msgSend, 'double', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull() ? '?' : r.readUtf8String(); };

var selRevealed = S('fullyRevealed');
var selHl = S('currentHighlightedItem');
var selKind = S('itemKind');

// hook the plugin's own tick
var watcherCls = objc_getClass(mk('AxsFanHoldWatcher'));
console.log('AxsFanHoldWatcher=' + (watcherCls.isNull() ? 'MISSING' : 'present'));
if (!watcherCls.isNull()) {
  var tick = class_getInstanceMethod(watcherCls, S('axs_fanhold_tick'));
  if (tick.isNull()) {
    console.log('tick method MISSING');
  } else {
    var imp = method_getImplementation(tick);
    var mod = Process.findModuleByAddress(imp);
    console.log('tick imp in ' + mod.name);
    var n = 0;
    Interceptor.attach(imp, {
      onEnter: function (args) {
        n++;
        if (n > 3 && n % 20 !== 0) return;  // print first 3, then every 20th
        var self = args[0];
        var line = 'TICK#' + n;
        try {
          var g = msgPtr(self, S('gesture'));
          if (!g.isNull()) {
            line += ' state=' + msgLong(g, S('state'));
            var menu = msgPtr(self, S('timer')); // just to confirm ivars readable
          } else line += ' gesture=nil';
        } catch (e) { line += ' err=' + e; }
        console.log(line);
      }
    });
    console.log('tick hooked');
  }
}
setInterval(function(){},1000);
