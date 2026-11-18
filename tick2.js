var objc_getClass = new NativeFunction(Module.findGlobalExportByName('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(Module.findGlobalExportByName('sel_registerName'), 'pointer', ['pointer']);
var class_getInstanceMethod = new NativeFunction(Module.findGlobalExportByName('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var method_getImplementation = new NativeFunction(Module.findGlobalExportByName('method_getImplementation'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(Module.findGlobalExportByName('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = Module.findGlobalExportByName('objc_msgSend');

var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var msgBool = new NativeFunction(objc_msgSend, 'bool', ['pointer','pointer']);
var msgLong = new NativeFunction(objc_msgSend, 'long', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull() ? '?' : r.readUtf8String(); };

var selView = S('view'), selWindow = S('window'), selSubviews = S('subviews'),
    selCount = S('count'), selObjAt = S('objectAtIndex:'),
    selRevealed = S('fullyRevealed'), selHl = S('currentHighlightedItem'),
    selKind = S('itemKind'), selCenters = S('buttonFinalCenters'),
    selItems = S('items'), selLoc = S('locationInView:');

var msgObjAt = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer','ulong']);
var msgCount = new NativeFunction(objc_msgSend, 'ulong', ['pointer','pointer']);

function findMenu(view, depth) {
  if (view.isNull() || depth < 0) return null;
  var cn = cname(view);
  if (cn === 'TOJBClass004') return view;
  var subs = msgPtr(view, selSubviews);
  if (subs.isNull()) return null;
  var c = msgCount(subs, selCount);
  for (var i = 0; i < c; i++) {
    var r = findMenu(msgObjAt(subs, selObjAt, i), depth - 1);
    if (r) return r;
  }
  return null;
}

var watcherCls = objc_getClass(mk('AxsFanHoldWatcher'));
var tick = class_getInstanceMethod(watcherCls, S('axs_fanhold_tick'));
var n = 0;
Interceptor.attach(method_getImplementation(tick), {
  onEnter: function (args) {
    n++;
    if (n > 2 && n % 15 !== 0) return;
    var self = args[0];
    var g = msgPtr(self, S('gesture'));
    if (g.isNull()) { console.log('#'+n+' gesture=nil'); return; }

    var fired = msgBool(self, S('fired'));
    var view = msgPtr(g, selView);
    var win = view.isNull() ? view : msgPtr(view, selWindow);
    var menu = win.isNull() ? null : findMenu(win, 12);

    var line = '#' + n + ' fired=' + fired + ' view=' + (view.isNull()?'nil':cname(view));
    if (!menu) {
      line += ' MENU=notfound';
    } else {
      line += ' MENU=ok revealed=' + msgBool(menu, selRevealed);
      var items = msgPtr(menu, selItems);
      line += ' items=' + (items.isNull()?'nil':msgCount(items, selCount));
      var hl = msgPtr(menu, selHl);
      if (hl.isNull()) line += ' hl=nil';
      else line += ' hl.kind=' + msgLong(hl, selKind) + ' hl.cls=' + cname(hl);
    }
    console.log(line);
  }
});
console.log('tick2 armed');
setInterval(function(){},1000);
