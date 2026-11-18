// Trace the plugin's own decision path on the real device.
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
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

var menuPtr = null;

// 1. capture menu (same as plugin)
var mc = objc_getClass(mk('TOJBClass004'));
if (mc) {
  var dm = class_getInstanceMethod(mc, sel_registerName(mk('didMoveToSuperview')));
  Interceptor.attach(method_getImplementation(dm), {
    onEnter: function (a) { menuPtr = a[0]; console.log('MENU captured'); }
  });
}

// 2. trace plugin's own tick: find AxsFanHold method axs_fanhold_tick
var our = Process.findModuleByName('AxsFanHold.dylib');
console.log('plugin module=' + (our ? our.base : 'MISSING'));

// 3. instrument gesture callback, print everything the plugin needs
var g = objc_getClass(mk('TOJBClass041'));
var cb = class_getInstanceMethod(g, sel_registerName(mk('TOJBMETHOD081:')));
var imp = method_getImplementation(cb);
var mod = Process.findModuleByAddress(imp);
console.log('081 imp in ' + mod.name);
var last = '';
Interceptor.attach(imp, {
  onEnter: function (args) {
    var gr = args[2];
    var st = L(gr, 'state');
    if (st !== 1 && st !== 2) return;
    var m = menuPtr;
    var rv = (m && !m.isNull()) ? B(m, 'fullyRevealed') : 'nomenu';
    var hl = (m && !m.isNull()) ? P(m, 'currentHighlightedItem') : null;
    var hlS = (!hl || hl.isNull()) ? 'nil' : ('kind=' + L(hl,'itemKind'));
    var key = st+'/'+rv+'/'+hlS;
    if (key === last) return;
    last = key;
    console.log('st='+st+' revealed='+rv+' hl='+hlS);
  }
});
console.log('trace10 armed');
setInterval(function(){},1000);
