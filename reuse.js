var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

var menuCls = objc_getClass(mk('TOJBClass004'));
var n = 0;
Interceptor.attach(mget(cgim(menuCls, S('didMoveToSuperview'))), {
  onEnter: function (args) {
    n++;
    var self = args[0];
    var sv = msgPtr(self, S('superview'));
    var win = msgPtr(self, S('window'));
    console.log('MOVE#' + n + ' self=' + self +
                ' superview=' + (sv.isNull()?'nil':cname(sv)) +
                ' window=' + (win.isNull()?'nil':(cname(win)+' hidden='+msgBool(win,S('isHidden'))+' alpha='+new NativeFunction(objc_msgSend,'double',['pointer','pointer'])(win,S('alpha')))) +
                ' selfHidden=' + msgBool(self, S('isHidden')));
  }
});
console.log('reuse armed');
setInterval(function(){},1000);
