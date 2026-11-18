var G = Module.findGlobalExportByName;
var objc_getClass = new NativeFunction(G('objc_getClass'), 'pointer', ['pointer']);
var sel_registerName = new NativeFunction(G('sel_registerName'), 'pointer', ['pointer']);
var object_getClassName = new NativeFunction(G('object_getClassName'), 'pointer', ['pointer']);
var objc_msgSend = G('objc_msgSend');
var msgPtr = new NativeFunction(objc_msgSend, 'pointer', ['pointer','pointer']);
var mk = function (s) { return Memory.allocUtf8String(s); };
var S = function (s) { return sel_registerName(mk(s)); };
var cname = function (p) { var r = object_getClassName(p); return r.isNull()?'?':r.readUtf8String(); };
var cgim = new NativeFunction(G('class_getInstanceMethod'), 'pointer', ['pointer','pointer']);
var cgcm = new NativeFunction(G('class_getClassMethod'), 'pointer', ['pointer','pointer']);
var mget = new NativeFunction(G('method_getImplementation'), 'pointer', ['pointer']);

function hook(cls, sel, label, isClass) {
  if (!cls || cls.isNull()) { console.log(label + ' class MISSING'); return; }
  var m = (isClass ? cgcm : cgim)(cls, S(sel));
  if (m.isNull()) { console.log(label + ' method MISSING'); return; }
  Interceptor.attach(mget(m), {
    onEnter: function (a) {
      var extra = '';
      for (var i = 2; i < 4; i++) {
        try {
          var o = a[i];
          if (!o.isNull()) extra += ' arg' + (i-1) + '=' + cname(o);
        } catch(e) {}
      }
      console.log(label + ' CALLED' + extra);
    },
    onLeave: function (r) {
      if (label.indexOf('Runner') !== -1) {
        try { console.log('   -> ret=' + r); } catch(e) {}
      }
    }
  });
  console.log(label + ' hooked');
}

// our own runner class method
var runner = objc_getClass(mk('AxsFanHoldShortcutRunner'));
hook(runner, 'axs_fanhold_runWorkflowIdentifier:', 'OURS', true);

// WorkflowKit runner
var wf = objc_getClass(mk('WFSpringBoardWorkflowRunnerClient'));
console.log('WFSpringBoardWorkflowRunnerClient=' + (wf.isNull()?'MISSING':'present'));
hook(wf, 'initWithWorkflowIdentifier:', 'WF.init', false);
hook(wf, 'start', 'WF.start', false);

// VoiceShortcutClient path (what TrollOpen itself uses)
var vc = objc_getClass(mk('VCVoiceShortcutClient'));
console.log('VCVoiceShortcutClient=' + (vc.isNull()?'MISSING':'present'));
hook(vc, 'runWorkflowWithDescriptor:request:completion:', 'VC.run', false);

console.log('exec armed');
setInterval(function(){},1000);
