var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
function mk(s){return Memory.allocUtf8String(s);}
function P(p,s){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function L(p,s){ return new NativeFunction(objc_msgSend,'long',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function U(p,s){ return new NativeFunction(objc_msgSend,'ulong',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function PO(p,s,i){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer','ulong'])(p, sel_registerName(mk(s)), i); }
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

var cls = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(cls, sel_registerName(mk('TOJBMETHOD081:')));
Interceptor.attach(method_getImplementation(m), {
  onEnter: function (args) {
    var gr = args[2];
    if (L(gr,'state') !== 1) return;
    console.log('--- Began ---');
    var view = P(gr, 'view');
    console.log('view=' + (view.isNull()?'nil':cname(view)));
    // full superview chain
    var chain = [];
    var v = view;
    for (var d=0; d<12 && !v.isNull(); d++) { chain.push(cname(v)); v = P(v,'superview'); }
    console.log('chain=' + chain.join(' > '));
    // window subtree: find any class exposing items+buttonFinalCenters
    var win = P(view, 'window');
    if (!win.isNull()) {
      var found = [];
      (function walk(x, dep) {
        if (dep > 14) return;
        var cn = cname(x);
        if (cn.indexOf('TOJB') === 0 && x.respondsToSelector_(sel_registerName(mk('buttonFinalCenters')))) {
          found.push(cn);
        }
        var subs = P(x,'subviews');
        if (!subs.isNull()) { var c=U(subs,'count'); for (var i=0;i<c;i++) walk(PO(subs,'objectAtIndex:',i), dep+1); }
      })(win, 0);
      console.log('menu-like in window=' + (found.join(',') || 'none'));
    }
  }
});
console.log('probe7 armed');
setInterval(function(){},1000);
