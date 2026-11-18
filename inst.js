var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var msgLong = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var msgUL = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);
var msgObjAt = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };

var selSubviews = S('subviews'), selCount = S('count'), selObjAt = S('objectAtIndex:');
var selRevealed = S('fullyRevealed'), selHl = S('currentHighlightedItem'), selKind = S('itemKind');
var selWindow = S('window'), selView = S('view'), selHidden = S('isHidden'), selAlpha = S('alpha');

function collect(view, depth, out) {
  if (view.isNull() || depth < 0) return;
  if (cname(view) === 'TOJBClass004') out.push(view);
  var subs = msgPtr(view, selSubviews);
  if (subs.isNull()) return;
  var c = msgUL(subs, selCount);
  for (var i = 0; i < c; i++) collect(msgObjAt(subs, selObjAt, i), depth-1, out);
}

var g = objc_getClass(mk('TOJBClass041'));
var cb = null;
if (!g.isNull()) {
  var f = Module.findGlobalExportByName('class_getInstanceMethod');
  var cgim = new NativeFunction(f, 'pointer', ['pointer','pointer']);
  var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);
  var meth = cgim(g, S('TOJBMETHOD081:'));
  cb = mget(meth);
}
var n = 0;
Interceptor.attach(cb, {
  onEnter: function (args) {
    n++;
    if (n % 10 !== 0) return;
    var gr = args[2];
    var view = msgPtr(gr, selView);
    var win = view.isNull() ? view : msgPtr(view, selWindow);
    if (win.isNull()) { console.log('#'+n+' no window'); return; }
    var list = [];
    collect(win, 14, list);
    var parts = [];
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      var hl = msgPtr(m, selHl);
      parts.push(i + ':rev=' + msgBool(m, selRevealed) +
                 ',hid=' + msgBool(m, selHidden) +
                 ',alpha=' + msgBool(m, selAlpha) +
                 ',hl=' + (hl.isNull()?'nil':msgLong(hl, selKind)));
    }
    console.log('#'+n+' menus='+list.length+' | '+parts.join(' ; '));
  }
});
console.log('inst armed');
setInterval(function(){},1000);
