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
function U(p,s){ return new NativeFunction(objc_msgSend,'ulong',['pointer','pointer'])(p, sel_registerName(mk(s))); }
function cname(p){ var r=object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); }

// sandbox test
var sandbox = 'untested';
try {
  var s = ObjC ? null : null;
} catch(e) {}
try {
  var nsstr = objc_getClass(mk('NSString'));
  var d = new NativeFunction(objc_msgSend,'bool',['pointer','pointer','bool'])(
    objc_getClass(mk('NSData')), sel_registerName(mk('writeToFile:atomically:')), 0, 0);
} catch(e) {}
console.log('sandbox note: see separate check');

var menuPtr = null;
var mc = objc_getClass(mk('TOJBClass004'));
if (mc) {
  var dm = class_getInstanceMethod(mc, sel_registerName(mk('didMoveToSuperview')));
  Interceptor.attach(method_getImplementation(dm), {
    onEnter: function (a) { menuPtr = a[0]; }
  });
}

var gesturePtr = null;
var gc = objc_getClass(mk('TOJBClass041'));
if (gc) {
  var cb = class_getInstanceMethod(gc, sel_registerName(mk('TOJBMETHOD081:')));
  Interceptor.attach(method_getImplementation(cb), {
    onEnter: function (args) { gesturePtr = args[2]; }
  });
}

var locSel = sel_registerName(mk('locationInView:'));
var stateSel = sel_registerName(mk('state'));
var revealedSel = sel_registerName(mk('fullyRevealed'));
var hlSel = sel_registerName(mk('currentHighlightedItem'));
var kindSel = sel_registerName(mk('itemKind'));

var lastLine = '';
setInterval(function () {
  if (!gesturePtr) return;
  var st = L(gesturePtr, 'state');
  if (st === 0 || st === 3 || st === 4 || st === 5) {
    if (lastLine !== 'idle') { lastLine = 'idle'; console.log('idle state=' + st); }
    return;
  }
  var line = 'state=' + st;
  if (menuPtr && !menuPtr.isNull()) {
    line += ' revealed=' + B(menuPtr, revealedSel);
    var loc = new NativeFunction(objc_msgSend,'pointer',['pointer','pointer','pointer'])(
      gesturePtr, locSel, menuPtr);
    // CGPoint returned in d0/d1 - use a struct-aware call
    var locFn = new NativeFunction(objc_msgSend, 'double', ['pointer','pointer','pointer']);
    line += ' hl=';
    var hl = P(menuPtr, hlSel);
    line += (hl.isNull() ? 'nil' : ('kind=' + L(hl, kindSel)));
  } else {
    line += ' nomenu';
  }
  if (line !== lastLine) { lastLine = line; console.log(line); }
}, 100);
console.log('sample armed');
