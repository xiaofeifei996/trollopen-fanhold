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
function D(p,s){ return new NativeFunction(objc_msgSend,'double',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function U(p,s){ return new NativeFunction(objc_msgSend,'ulong',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function PO(p,s,i){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer','ulong'])(p, sel_registerName(mk(s)), i); }
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

var cls = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(cls, sel_registerName(mk('TOJBMETHOD081:')));
var imp = method_getImplementation(m);
var lastKey = '';
Interceptor.attach(imp, {
  onEnter: function (args) {
    var gr = args[2];
    var st = L(gr, 'state');
    var tracking = B(gr, 'trackingGestureActive');
    // find menu
    var view = P(gr, 'view');
    var menu = null;
    for (var d=0; d<10 && !view.isNull(); d++) {
      if (cname(view) === 'TOJBClass004') { menu = view; break; }
      view = P(view, 'superview');
    }
    var key = st + '/' + tracking + '/' + (menu ? 'menu' : 'nomenu');
    if (key === lastKey) return;
    lastKey = key;
    var extra = '';
    if (menu) {
      extra += ' revealed=' + B(menu, 'fullyRevealed');
      extra += ' items=' + U(P(menu,'items'), 'count');
      var centers = P(menu, 'buttonFinalCenters');
      extra += ' centers=' + (centers.isNull() ? 'nil' : U(centers,'count'));
      extra += ' iconSize=' + D(menu, 'iconSize');
      var hl = P(menu, 'currentHighlightedItem');
      extra += ' hl=' + (hl.isNull() ? 'nil' : cname(hl));
      if (!hl.isNull()) {
        extra += ' kind=' + L(hl, 'itemKind');
        var idn = P(hl, 'identifier');
        extra += ' id=' + (idn.isNull() ? 'nil' : idn.readUtf8String());
      }
    }
    console.log('st=' + st + ' tracking=' + tracking + extra);
  }
});
console.log('probe6 armed');
setInterval(function(){},1000);
