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
var hasSel = new NativeFunction(Module.findGlobalExportByName('class_respondsToSelector'), 'bool', ['pointer','pointer']);
var object_getClass = new NativeFunction(Module.findGlobalExportByName('object_getClass'), 'pointer', ['pointer']);

var menuCls = objc_getClass(mk('TOJBClass004'));
var m = class_getInstanceMethod(menuCls, sel_registerName(mk('didMoveToSuperview')));
Interceptor.attach(method_getImplementation(m), {
  onEnter: function (args) {
    var self = args[0];
    setTimeout(function () {
      var win = P(self, 'window');
      var chain = [];
      var v = self;
      for (var d=0; d<10 && !v.isNull(); d++) { chain.push(cname(v)); v = P(v,'superview'); }
      console.log('MENU chain=' + chain.join(' > '));
      console.log('MENU items=' + U(P(self,'items'),'count') +
                  ' centers=' + U(P(self,'buttonFinalCenters'),'count') +
                  ' iconSize=' + new NativeFunction(objc_msgSend,'double',['pointer','pointer'])(self, sel_registerName(mk('iconSize'))) +
                  ' revealed=' + new NativeFunction(objc_msgSend,'bool',['pointer','pointer'])(self, sel_registerName(mk('fullyRevealed'))));
    }, 300);
  }
});
console.log('probe8 armed');
setInterval(function(){},1000);
