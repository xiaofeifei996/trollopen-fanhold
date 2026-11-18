var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgLong = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

var menuCls = objc_getClass(mk('TOJBClass004'));
var setter = cgim(menuCls, S('setCurrentHighlightedItem:'));
Interceptor.attach(mget(setter), {
  onEnter: function (args) {
    var item = args[2];
    if (item.isNull()) { console.log('HL <- nil'); return; }
    var kind = -1, ident = '?';
    try { kind = msgLong(item, S('itemKind')); } catch(e) {}
    try {
      var idn = msgPtr(item, S('identifier'));
      ident = idn.isNull() ? 'nil' : idn.readUtf8String();
    } catch(e) {}
    console.log('HL <- ' + cname(item) + ' kind=' + kind + ' id=' + ident);
  }
});
console.log('hl armed');
setInterval(function(){},1000);
