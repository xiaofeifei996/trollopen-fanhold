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

var selUTF8 = S('UTF8String');
var selAllKeys = S('allKeys');
var selCount = S('count');
var selObjAt = S('objectAtIndex:');
var selObjForKey = S('objectForKeyedSubscript:');

function utf8(str) {
  if (!str || str.isNull()) return 'nil';
  var p = msgPtr(str, selUTF8);
  if (p.isNull()) return '?';
  try { return p.readCString(); } catch (e) { return '<bin>'; }
}

var menuCls = objc_getClass(mk('TOJBClass004'));
var n = 0;
Interceptor.attach(mget(cgim(menuCls, S('setCurrentHighlightedItem:'))), {
  onEnter: function (args) {
    var item = args[2];
    if (item.isNull()) return;
    n++;
    if (n > 6) return;
    var cn = cname(item);
    console.log('=== item#' + n + ' cls=' + cn);
    if (cn.indexOf('Dictionary') === -1 && cn.indexOf('NSDictionary') === -1) return;
    var keys = msgPtr(item, selAllKeys);
    var c = msgUL(keys, selCount);
    var parts = [];
    for (var i = 0; i < c; i++) {
      var k = msgObjAt(keys, selObjAt, i);
      var v = msgPtr(item, selObjForKey);
      parts.push(utf8(k));
    }
    console.log('   keys: ' + parts.join(', '));
  }
});
console.log('dict2 armed');
setInterval(function(){},1000);
