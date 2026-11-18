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

var selSubviews=S('subviews'), selCount=S('count'), selObjAt=S('objectAtIndex:');
var selCenters=S('buttonFinalCenters'), selItems=S('items'), selWindow=S('window'), selView=S('view');
var selLoc=S('locationInView:'), selKind=S('itemKind'), selIdent=S('identifier');

// CGPoint-returning msgSend: d0/d1
function locationIn(gr, view) {
  var fn = new NativeFunction(objc_msgSend, 'double', ['pointer','pointer','pointer']);
  // call twice is wrong; use struct return via arm64 ABI: small struct {double,double} in d0/d1
  var f = new NativeFunction(objc_msgSend, 'void', ['pointer','pointer','pointer']);
  // Use Memory to capture - Frida supports 'double' twice? Do manual:
  return null;
}

function collect(view, depth, out) {
  if (view.isNull() || depth < 0) return;
  if (cname(view) === 'TOJBClass004') out.push(view);
  var subs = msgPtr(view, selSubviews);
  if (subs.isNull()) return;
  var c = msgUL(subs, selCount);
  for (var i=0;i<c;i++) collect(msgObjAt(subs, selObjAt, i), depth-1, out);
}

var g = objc_getClass(mk('TOJBClass041'));
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);
var cb = mget(cgim(g, S('TOJBMETHOD081:')));

var n = 0;
Interceptor.attach(cb, {
  onEnter: function (args) {
    n++;
    if (n % 10 !== 0) return;
    var gr = args[2];
    var view = msgPtr(gr, selView);
    var win = msgPtr(view, selWindow);
    var list = [];
    collect(win, 14, list);
    if (!list.length) { console.log('#'+n+' no menu'); return; }
    var menu = list[0];
    var centers = msgPtr(menu, selCenters);
    var items = msgPtr(menu, selItems);
    if (centers.isNull() || items.isNull()) { console.log('#'+n+' nil arrays'); return; }
    var cCount = msgUL(centers, selCount);
    var iCount = msgUL(items, selCount);
    var first = msgObjAt(centers, selObjAt, 0);
    var last = msgObjAt(centers, selObjAt, cCount - 1);
    var p0 = first.add(16).readPointer(); // NSValue stores CGPoint at +16
    console.log('#'+n+' centers='+cCount+' items='+iCount+
                ' first=' + (first.isNull()?'nil':'ok') +
                ' cname=' + cname(first));
    // read NSValue CGPoint: offset 16 holds two doubles on 64-bit
    var x = first.add(16).readDouble();
    var y = first.add(24).readDouble();
    console.log('   center0=(x,y)');
  }
});
console.log('geo armed');
setInterval(function(){},1000);
