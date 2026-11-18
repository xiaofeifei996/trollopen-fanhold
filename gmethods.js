// Read real target/action pairs off the TOJBClass041 instance.
var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var class_copyMethodList = new NativeFunction(Module.findGlobalExportByName('class_copyMethodList'), 'pointer', ['pointer','pointer']);
var method_getName = new NativeFunction(Module.findGlobalExportByName('method_getName'), 'pointer', ['pointer']);
var sel_getName = new NativeFunction(Module.findGlobalExportByName('sel_getName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }
function cls(n) { var p = objc_getClass(mk(n)); return p.isNull() ? null : p; }
function cname(p) { var r = object_getClassName(p); return r.isNull() ? '?' : r.readUtf8String(); }
function P(p, s) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer'])(p, sel_registerName(mk(s))); }
function U(p, s) { return new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer'])(p, sel_registerName(mk(s))); }
function PO(p, s, i) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong'])(p, sel_registerName(mk(s)), i); }

// Dump TOJBClass041 own methods, with IMP owners
var g = cls('TOJBClass041');
if (g) {
  var countPtr = Memory.alloc(4);
  var list = class_copyMethodList(g, countPtr);
  var n = countPtr.readU32();
  console.log('TOJBClass041 own methods=' + n);
  for (var i = 0; i < n; i++) {
    var meth = list.add(i * Process.pointerSize).readPointer();
    var nm = sel_getName(method_getName(meth)).readUtf8String();
    var imp = method_getImplementation(meth);
    var mod = Process.findModuleByAddress(imp);
    console.log('  ' + nm + '  imp=' + imp + ' in ' + (mod ? mod.name : '?'));
  }
}

// Walk window tree, find the TOJBClass041 instance, read its target/action ivars
var menuClass = cls('TOJBClass004');
if (menuClass) {
  var m = class_getInstanceMethod(menuClass, sel_registerName(mk('didMoveToSuperview')));
  Interceptor.attach(method_getImplementation(m), {
    onEnter: function () {
      var self = this.context.x0;
      var win = P(self, 'window');
      if (win.isNull()) return;
      var found = [];
      (function walk(v, d) {
        if (d > 12) return;
        var gs = P(v, 'gestureRecognizers');
        if (!gs.isNull()) {
          var c = U(gs, 'count');
          for (var i = 0; i < c; i++) {
            var gg = PO(gs, 'objectAtIndex:', i);
            if (cname(gg) === 'TOJBClass041') found.push(gg);
          }
        }
        var subs = P(v, 'subviews');
        if (!subs.isNull()) {
          var sc = U(subs, 'count');
          for (var j = 0; j < sc; j++) walk(PO(subs, 'objectAtIndex:', j), d + 1);
        }
      })(win, 0);

      console.log('TOJBClass041 instances=' + found.length);
      for (var k = 0; k < found.length; k++) {
        var inst = found[k];
        var v = P(inst, 'view');
        console.log('  instance ' + k + ' on ' + (v.isNull() ? '?' : cname(v)) +
                    ' state=' + new NativeFunction(objc_msgSend,'long',['pointer','pointer'])(inst, sel_registerName(mk('state'))));
      }
    }
  });
  console.log('armed');
}
setInterval(function () {}, 1000);
