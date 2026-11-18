var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
function mk(s){return Memory.allocUtf8String(s);}
var cls = objc_getClass(mk('TOJBClass041'));
var m = class_getInstanceMethod(cls, sel_registerName(mk('TOJBMETHOD081:')));
var imp = method_getImplementation(m);
var stateFn = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var seen = {};
Interceptor.attach(imp, {
  onEnter: function (args) {
    var self = args[0], cmd = args[1], gr = args[2];
    var cn = object_getClassName(gr);
    var cnS = cn.isNull() ? 'null' : cn.readUtf8String();
    var st = -1;
    if (cnS !== 'null') { try { st = stateFn(gr, sel_registerName(mk('state'))); } catch(e){} }
    var key = cnS + '/' + st;
    if (!seen[key]) { seen[key] = 0; console.log('081 arg2=' + cnS + ' state=' + st); }
    seen[key]++;
  }
});
console.log('probe5 armed');
setInterval(function(){},1000);
