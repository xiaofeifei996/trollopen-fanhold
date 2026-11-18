var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgUL = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);
var msgObjAt = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

var desc = S('description');
var menuCls = objc_getClass(mk('TOJBClass004'));
Interceptor.attach(mget(cgim(menuCls, S('setCurrentHighlightedItem:'))), {
  onEnter: function (args) {
    var item = args[2];
    if (item.isNull()) return;
    var cn = cname(item);
    if (cn !== '__NSDictionaryI' && cn !== '__NSDictionaryM') return;
    var d = msgPtr(item, desc);
    var s = d.isNull() ? '(nil)' : d.readUtf8String();
    console.log('DICT ' + s);
    var keys = msgPtr(item, S('allKeys'));
    var vals = msgPtr(item, S('allValues'));
    var kc = msgUL(keys, S('count'));
    for (var i = 0; i < kc; i++) {
      var k = msgObjAt(keys, S('objectAtIndex:'), i);
      var v = msgObjAt(vals, S('objectAtIndex:'), i);
      var ks = msgPtr(k, desc);
      var vs = msgPtr(v, desc);
      console.log('   key=' + (ks.isNull()?'?':ks.readUtf8String()) +
                  '  val=' + (vs.isNull()?'?':vs.readUtf8String()) +
                  '  valcls=' + (v.isNull()?'?':cname(v)));
    }
  }
});
console.log('dict armed');
setInterval(function(){},1000);
