var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgUL = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);
var msgLong = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var msgObjAt = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

function strOf(o) {
  if (!o || o.isNull()) return 'nil';
  var d = msgPtr(o, S('description'));
  if (d.isNull()) return '?';
  var u = msgPtr(d, S('UTF8String'));
  return u.isNull() ? '?' : u.readCString();
}

var W = objc_getClass(mk('AxsFanHoldWatcher'));
console.log('watcher=' + (W.isNull()?'MISSING':'present'));
var tick = cgim(W, S('axs_fanhold_tick'));
var n = 0;
Interceptor.attach(mget(tick), {
  onEnter: function (a) {
    n++;
    if (n % 8 !== 0) return;
    var self = a[0];
    var fired = msgBool(self, S('fired'));
    var g = msgPtr(self, S('gesture'));
    var menu = msgPtr(self, S('menu'));
    console.log('#' + n + ' fired=' + fired + ' gesture=' + (g.isNull()?'nil':cname(g)));
    // read plugin's weak global via its own resolve? just inspect current menu from window
    var view = g.isNull() ? null : msgPtr(g, S('view'));
    var win = (view && !view.isNull()) ? msgPtr(view, S('window')) : null;
    if (!win || win.isNull()) { console.log('   no window'); return; }
    var hl = null;
    // walk to find menu
    (function walk(x, d) {
      if (hl || d < 0 || x.isNull()) return;
      if (cname(x) === 'TOJBClass004') { hl = x; return; }
      var subs = msgPtr(x, S('subviews'));
      if (subs.isNull()) return;
      var c = msgUL(subs, S('count'));
      for (var i = 0; i < c && !hl; i++) walk(msgObjAt(subs, S('objectAtIndex:'), i), d-1);
    })(win, 14);
    if (!hl) { console.log('   MENU not found'); return; }
    var hli = msgPtr(hl, S('currentHighlightedItem'));
    console.log('   MENU ok hl=' + (hli.isNull() ? 'nil' : strOf(hli).slice(0,160).replace(/\n\s*/g,' ')));
  }
});
console.log('deep armed');
setInterval(function(){},1000);
