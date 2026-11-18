// QJS (no ObjC binding) — talk to the ObjC runtime via NativeFunction.
var objc_getClass = new NativeFunction(
  Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(
  Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(
  Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer', 'pointer']);
var method_getImplementation = new NativeFunction(
  Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var objc_msgSend_ptr = Module.findGlobalExportByName('objc_msgSend');

function mk(s) { return Memory.allocUtf8String(s); }

function cls(name) {
  var p = objc_getClass(mk(name));
  return p.isNull() ? null : p;
}

console.log('=== runtime probe ===');

var gesture = cls('TOJBClass041');
console.log('TOJBClass041=' + (gesture ? 'present' : 'MISSING'));

var menu = cls('TOJBClass004');
console.log('TOJBClass004=' + (menu ? 'present' : 'MISSING'));

if (gesture) {
  var sel = sel_registerName(mk('TOJBMETHOD081:'));
  var m = class_getInstanceMethod(gesture, sel);
  if (m.isNull()) {
    console.log('TOJBMETHOD081: NOT FOUND on TOJBClass041');
  } else {
    var imp = method_getImplementation(m);
    console.log('TOJBMETHOD081: imp=' + imp);
    // Resolve which image contains the implementation.
    var mod = Process.findModuleByAddress(imp);
    console.log('imp belongs to: ' + (mod ? mod.name : 'unknown') + ' @ ' + (mod ? mod.base : '?'));
  }
}

// Check whether our hook image exports the replacement symbol.
var ourMod = null;
var mods = Process.enumerateModules();
for (var i = 0; i < mods.length; i++) {
  if (mods[i].name.indexOf('AxsFanHold') !== -1) { ourMod = mods[i]; break; }
}
if (ourMod) {
  console.log('our module base=' + ourMod.base + ' path=' + ourMod.path);
}

setInterval(function () {}, 1000);
