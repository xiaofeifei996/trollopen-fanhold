var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var class_copyMethodList = new NativeFunction(Module.findGlobalExportByName('class_copyMethodList'), 'pointer', ['pointer','pointer']);
var method_getName = new NativeFunction(Module.findGlobalExportByName('method_getName'), 'pointer', ['pointer']);
var sel_getName = new NativeFunction(Module.findGlobalExportByName('sel_getName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');
function mk(s){return Memory.allocUtf8String(s);}
function P(p,s){ return new NativeFunction(objc_msgSend,'pointer',['pointer','pointer'])(p, sel_registerName(mk(s))); }

var counts = {};
var menuCls = objc_getClass(mk('TOJBClass004'));
var cnt = Memory.alloc(4);
var list = class_copyMethodList(menuCls, cnt);
var n = cnt.readU32();
console.log('TOJBClass004 own methods=' + n);
var hooked = 0;
for (var i = 0; i < n; i++) {
  var meth = list.add(i * Process.pointerSize).readPointer();
  var nm = sel_getName(method_getName(meth)).readUtf8String();
  var imp = method_getImplementation(meth);
  var mod = Process.findModuleByAddress(imp);
  if (!mod || mod.name.indexOf('TrollOpenJB') === -1) continue;
  (function (name, addr) {
    Interceptor.attach(addr, {
      onEnter: function () {
        counts[name] = (counts[name] || 0) + 1;
      }
    });
  })(nm, imp);
  hooked++;
}
console.log('hooked ' + hooked + ' TrollOpenJB methods on TOJBClass004');

// report on a timer, only methods that fired
setInterval(function () {
  var keys = Object.keys(counts);
  if (keys.length) {
    console.log('FIRED: ' + keys.map(function(k){return k+'x'+counts[k];}).join(' '));
    counts = {};
  }
}, 700);
