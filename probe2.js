// Probe every candidate callback on TOJBClass041 while the user interacts.
var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var class_copyMethodList = new NativeFunction(Module.findGlobalExportByName('class_copyMethodList'), 'pointer', ['pointer','pointer']);
var method_getName = new NativeFunction(Module.findGlobalExportByName('method_getName'), 'pointer', ['pointer']);
var sel_getName = new NativeFunction(Module.findGlobalExportByName('sel_getName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }
function cls(n) { var p = objc_getClass(mk(n)); return p.isNull() ? null : p; }

var target = cls('TOJBClass041');
if (target) {
  var cnt = Memory.alloc(4);
  var list = class_copyMethodList(target, cnt);
  var n = cnt.readU32();
  var hooked = 0;
  for (var i = 0; i < n; i++) {
    var meth = list.add(i * Process.pointerSize).readPointer();
    var nm = sel_getName(method_getName(meth)).readUtf8String();
    if (nm === 'init' || nm === 'reset' || nm === 'dealloc') continue;
    if (nm.indexOf('canBe') === 0 || nm.indexOf('canPrevent') === 0) continue;
    var imp = method_getImplementation(meth);
    var mod = Process.findModuleByAddress(imp);
    if (!mod || mod.name.indexOf('AxsFanHold') !== -1) continue;

    (function (name, addr) {
      Interceptor.attach(addr, {
        onEnter: function (args) {
          var st = -1;
          try {
            st = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer'])(
                   args[1], sel_registerName(mk('state')));
          } catch (e) {}
          console.log('>>> ' + name + ' state=' + st);
        }
      });
    })(nm, imp);
    hooked++;
  }
  console.log('hooked ' + hooked + ' candidate methods on TOJBClass041');
}
setInterval(function () {}, 1000);
