console.log('=== AxsFanHold diagnostic ===');
console.log('pid=' + Process.id + ' arch=' + Process.arch);

var mods = Process.enumerateModules();
var hit = null;
for (var i = 0; i < mods.length; i++) {
  if (mods[i].name.indexOf('AxsFanHold') !== -1) { hit = mods[i]; break; }
}
if (hit) {
  console.log('LOADED: ' + hit.name + ' @ ' + hit.base + ' size=' + hit.size);
} else {
  console.log('NOT_LOADED: AxsFanHold.dylib absent from this process');
  var tj = [];
  for (var j = 0; j < mods.length; j++) {
    if (mods[j].path && mods[j].path.indexOf('TweakInject') !== -1) tj.push(mods[j].name);
  }
  console.log('TweakInject modules count=' + tj.length);
  console.log('sample=' + tj.slice(0, 25).join(','));
}

// TrollOpen classes
var names = ['TOJBClass041', 'TOJBClass004', 'TOJBClass031', 'TOJBClass009'];
for (var k = 0; k < names.length; k++) {
  var c = ObjC.classes[names[k]];
  console.log(names[k] + '=' + (c ? 'present' : 'missing'));
}

var g = ObjC.classes.TOJBClass041;
if (g) {
  var sel = 'TOJBMETHOD081:';
  var has = false;
  try {
    var methods = g.$ownMethods;
    for (var m = 0; m < methods.length; m++) {
      if (methods[m].indexOf(sel) !== -1) { has = true; break; }
    }
  } catch (e) {
    console.log('ownMethods err ' + e);
  }
  console.log('TOJBMETHOD081 present=' + has);
}

setInterval(function () {}, 1000);
