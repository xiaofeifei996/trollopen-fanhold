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
function U(p,s){ return new NativeFunction(objc_msgSend,'ulong',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function PO(p,s,i){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer','ulong'])(p, sel_registerName(mk(s)), i); }
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

var g = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(g, sel_registerName(mk('TOJBMETHOD081:')));
var last = null;
Interceptor.attach(method_getImplementation(m), {
  onEnter: function (args) {
    var gr = args[2];
    var st = L(gr, 'state');
    if (st !== 2 && st !== 3) return;
    // find menu via view chain
    var v = P(gr, 'view');
    var menu = null;
    for (var d=0; d<10 && !v.isNull(); d++) {
      if (cname(v) === 'TOJBClass004') { menu = v; break; }
      v = P(v, 'superview');
    }
    if (!menu) { console.log('st=' + st + ' NO MENU'); return; }
    var rv = B(menu, 'fullyRevealed');
    var hl = P(menu, 'currentHighlightedItem');
    var hlS = hl.isNull() ? 'nil' : (cname(hl) + ' kind=' + L(hl,'itemKind'));
    var key = st + '/' + rv + '/' + hlS;
    if (key === last) return;
    last = key;
    console.log('st=' + st + ' revealed=' + rv + ' hl=' + hlS);
  }
});
console.log('probe9 armed');
setInterval(function(){},1000);
