// Find which gesture recognizers actually drive the fan menu.
var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }
function cls(n) { var p = objc_getClass(mk(n)); return p.isNull() ? null : p; }
function cname(p) {
  var r = object_getClassName(p);
  return r.isNull() ? '?' : r.readUtf8String();
}
function msg(p, sel) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer'])(p, sel_registerName(mk(sel))); }

var menuClass = cls('TOJBClass004');
console.log('menu class=' + (menuClass ? 'ok' : 'missing'));

if (menuClass) {
  var sel = sel_registerName(mk('didMoveToSuperview'));
  var m = class_getInstanceMethod(menuClass, sel);
  var imp = method_getImplementation(m);
  console.log('didMoveToSuperview imp=' + imp + ' in ' + Process.findModuleByAddress(imp).name);

  Interceptor.attach(imp, {
    onEnter: function () {
      var self = this.context.x0;
      // gestureRecognizers on the menu view
      var arr = msg(self, 'gestureRecognizers');
      var count = 0;
      var names = [];
      if (!arr.isNull()) {
        var cntFn = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);
        var objFn = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong']);
        count = cntFn(arr, sel_registerName(mk('count')));
        for (var i = 0; i < count && i < 12; i++) {
          var g = objFn(arr, sel_registerName(mk('objectAtIndex:')), i);
          names.push(cname(g));
        }
      }
      console.log('MENU added; gestures(' + count + ')=' + names.join(','));

      // superview chain
      var sv = msg(self, 'superview');
      var chain = [];
      for (var d = 0; d < 6 && !sv.isNull(); d++) {
        chain.push(cname(sv));
        sv = msg(sv, 'superview');
      }
      console.log('superchain=' + chain.join(' > '));
    }
  });
}
setInterval(function () {}, 1000);
