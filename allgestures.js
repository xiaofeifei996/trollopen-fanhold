// Dump every gesture recognizer in the TrollOpen window subtree, with targets.
var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }
function cls(n) { var p = objc_getClass(mk(n)); return p.isNull() ? null : p; }
function cname(p) { var r = object_getClassName(p); return r.isNull() ? '?' : r.readUtf8String(); }
function P(p, s) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer'])(p, sel_registerName(mk(s))); }
function U(p, s) { return new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer'])(p, sel_registerName(mk(s))); }
function PO(p, s, i) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong'])(p, sel_registerName(mk(s)), i); }
function SELOF(p) { return new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer'])(p, sel_registerName(mk('description'))); }

var walkDepth = 0;
function walk(view, depth, out) {
  if (depth > 12) return;
  var gs = P(view, 'gestureRecognizers');
  if (!gs.isNull()) {
    var n = U(gs, 'count');
    for (var i = 0; i < n; i++) {
      var g = PO(gs, 'objectAtIndex:', i);
      var info = cname(g) + ' on ' + cname(view);
      // gesture target/action pairs are private; show enabled + state
      try {
        var en = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer'])(g, sel_registerName(mk('isEnabled')));
        info += ' enabled=' + en;
      } catch (e) {}
      out.push(info);
    }
  }
  var subs = P(view, 'subviews');
  if (!subs.isNull()) {
    var c = U(subs, 'count');
    for (var j = 0; j < c; j++) walk(PO(subs, 'objectAtIndex:', j), depth + 1, out);
  }
}

var menuClass = cls('TOJBClass004');
if (menuClass) {
  var m = class_getInstanceMethod(menuClass, sel_registerName(mk('didMoveToSuperview')));
  var imp = method_getImplementation(m);
  Interceptor.attach(imp, {
    onEnter: function () {
      var self = this.context.x0;
      var win = P(self, 'window');
      var out = [];
      if (!win.isNull()) {
        walk(win, 0, out);
        console.log('=== gestures in window (' + out.length + ') ===');
        for (var i = 0; i < out.length && i < 40; i++) console.log('  ' + out[i]);
      } else {
        console.log('no window yet');
      }
    }
  });
  console.log('walker armed');
}
setInterval(function () {}, 1000);
