var g = Module.findGlobalExportByName('objc_getClass');
var objc_getClass = new NativeFunction(g, 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
function mk(s){return Memory.allocUtf8String(s);}
var cls = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(cls, sel_registerName(mk('TOJBMETHOD081:')));
var imp = method_getImplementation(m);
var mod = Process.findModuleByAddress(imp);
console.log('081 imp in ' + mod.name);
var stateFn = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
Interceptor.attach(imp, {
  onEnter: function (args) {
    var self = args[0], gr = args[1];
    var st = -1;
    try { st = stateFn(gr, sel_registerName(mk('state'))); } catch(e) {}
    console.log('081 called state=' + st);
  }
});
console.log('attached to 081');
setInterval(function(){},1000);
