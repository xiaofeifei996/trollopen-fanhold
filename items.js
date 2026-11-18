var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgUL = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);
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

var menuCls = objc_getClass(mk('TOJBClass004'));
var once = 0;
Interceptor.attach(mget(cgim(menuCls, S('layoutSubviews'))), {
  onEnter: function (args) {
    if (once >= 2) return;
    var self = args[0];
    var items = msgPtr(self, S('items'));
    if (items.isNull()) return;
    var c = msgUL(items, S('count'));
    if (c === 0) return;
    once++;
    console.log('=== items count=' + c);
    for (var i = 0; i < Math.min(4, c); i++) {
      var it = msgObjAt(items, S('objectAtIndex:'), i);
      console.log('  [' + i + '] cls=' + cname(it) + ' desc=' + strOf(it).slice(0, 200));
    }
    var centers = msgPtr(self, S('buttonFinalCenters'));
    if (!centers.isNull()) {
      var cv = msgObjAt(centers, S('objectAtIndex:'), 0);
      console.log('  center0 cls=' + cname(cv) + ' desc=' + strOf(cv));
    }
  }
});
console.log('items armed');
setInterval(function(){},1000);
