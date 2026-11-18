var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
function mk(s){return Memory.allocUtf8String(s);}
function P(p,s){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function B(p,s){ return new NativeFunction(objc_msgSend,'bool',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function L(p,s){ return new NativeFunction(objc_msgSend,'long',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

var menuPtr = null;
var menuCls = objc_getClass(mk('TOJBClass004'));
var dm = class_getInstanceMethod(menuCls, sel_registerName(mk('didMoveToSuperview')));
Interceptor.attach(method_getImplementation(dm), {
  onEnter: function (args) { menuPtr = args[0]; console.log('menu captured'); }
});

var g = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(g, sel_registerName(mk('TOJBMETHOD081:')));
var last = '';
Interceptor.attach(method_getImplementation(m), {
  onEnter: function (args) {
    var gr = args[2];
    var st = L(gr, 'state');
    if (st !== 1 && st !== 2 && st !== 3) return;
    var rv = menuPtr ? B(menuPtr, 'fullyRevealed') : 'nomenu';
    var hl = menuPtr ? P(menuPtr, 'currentHighlightedItem') : null;
    var hlS = (!hl || hl.isNull()) ? 'nil' : ('kind=' + L(hl,'itemKind'));
    var key = st + '/' + rv + '/' + hlS;
    if (key === last) return;
    last = key;
    console.log('st=' + st + ' revealed=' + rv + ' hl=' + hlS + ' tracking=' + B(gr,'trackingGestureActive'));
  }
});
console.log('probe10 armed');
setInterval(function(){},1000);
