var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

function strOf(obj) {
  if (!obj || obj.isNull()) return 'nil';
  var d = msgPtr(obj, S('description'));
  if (d.isNull()) return '?';
  var u = msgPtr(d, S('UTF8String'));
  if (u.isNull()) return '?';
  try { return u.readCString(); } catch (e) { return '<bin>'; }
}

var menuCls = objc_getClass(mk('TOJBClass004'));
var n = 0;
Interceptor.attach(mget(cgim(menuCls, S('setCurrentHighlightedItem:'))), {
  onEnter: function (args) {
    n++;
    if (n % 3 !== 0) return;
    var item = args[2];
    console.log('HL#' + n + ' ' + strOf(item).slice(0, 300));
  }
});
console.log('dict3 armed');
setInterval(function(){},1000);
