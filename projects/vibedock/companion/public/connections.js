import {BadgeBluetooth} from './bluetooth.mjs';
const $=id=>document.getElementById(id),esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachConnections({api,toast,onPaired,getState}){
 let info=null,prompt=null;const bluetooth=new BadgeBluetooth({api,onStatus:note=>{$('bleStatus').textContent=note}});
 function stateChanged(){const role=getState()?.access?.role||'admin';$('connectionsButton').textContent=role==='admin'?'多端连接':'连接信息';$('guideButton').hidden=role!=='admin';$('settingsButton').hidden=role!=='admin';$('connectionsAdmin').hidden=role!=='admin';$('connectionsRemote').hidden=role==='admin';$('remoteRole').textContent=role==='viewer'?'仅查看 · 可切换工具与阅读任务':'已授权控制 · 操作将发送到电脑';$('mode').disabled=role!=='admin';$('refresh').disabled=role!=='admin';$('devSection').hidden=role!=='admin';$('deviceToggle').hidden=role!=='admin'}
 document.addEventListener('vibedock:state',stateChanged);
 async function refresh(){
  stateChanged();if(getState()?.access?.role!=='admin')return;
  info=await api('/api/network');$('lanStatus').textContent=info.enabled?`已开启 · ${info.tls?'HTTPS':'同一网络内 HTTP'}`:'尚未开启';$('lanToggle').textContent=info.enabled?'关闭局域网':'开启局域网';
  $('inviteAddress').innerHTML=info.urls.map((url,i)=>`<option value="${i}">${esc(url)}</option>`).join('');
  $('relayStatus').textContent=info.relay.note;$('relayDisconnect').hidden=!info.relay.url;$('inviteKind').querySelector('[value="wan"]').disabled=!info.relay.connected;
  $('pairedDevices').innerHTML=info.devices.map(d=>`<div class="paired-row"><span><b>${esc(d.name)}</b><small>${d.role==='viewer'?'仅查看':'可控制'} · 授权 24 小时</small></span><button class="secondary" data-revoke="${esc(d.id)}">移除</button></div>`).join('')||'<p class="muted">还没有配对设备</p>';
 }
 async function pair(invite){
  let token=String(invite).trim();try{const url=new URL(token);token=new URLSearchParams(url.hash.slice(1)).get('invite')||token}catch{}
  const result=await api('/api/pair',{invite:token,name:$('pairName').value||'我的手机'});$('pairInput').value='';$('pairDialog').close();toast(result.access.role==='viewer'?'配对成功，可以查看任务':'配对成功，已获得电脑授权的控制权限');return result;
 }
 document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||b.disabled)return;
  try{
   if(b.id==='connectionsButton'){$('connectionsDialog').showModal();await refresh()}
   if(b.id==='desktopPin'&&window.vibeDesktop){const pinned=await window.vibeDesktop.togglePin();b.setAttribute('aria-pressed',String(pinned));b.textContent=pinned?'取消置顶':'置顶'}
   if(b.id==='desktopClose')window.vibeDesktop?.close();
   if(b.id==='lanToggle'){b.disabled=true;try{await api('/api/network',{enabled:!info?.enabled});$('inviteBox').hidden=true;await refresh()}finally{b.disabled=false}}
   if(b.id==='createInvite'){b.disabled=true;try{const result=await api('/api/invite',{kind:$('inviteKind').value,role:$('inviteRole').value,address:Number($('inviteAddress').value),name:'我的手机'});$('inviteQr').src=result.qr;$('inviteLink').value=result.link;$('inviteExpiry').textContent='5 分钟内有效，每个链接只能配对一次。手机授权 24 小时，电脑重启后需重新配对。';$('inviteBox').hidden=false}catch(e){throw e}finally{b.disabled=false}}
   if(b.id==='copyInvite'){try{await navigator.clipboard.writeText($('inviteLink').value);toast('配对链接已复制')}catch{$('inviteLink').select();toast('请复制已选中的配对链接')}}
   if(b.dataset.revoke){await api('/api/devices/revoke',{id:b.dataset.revoke});await refresh()}
   if(b.id==='relayDisconnect'){await api('/api/relay',{disconnect:true});await refresh()}
   if(b.id==='networkRefresh')await refresh();
   if(b.id==='bleConnect'||b.id==='bleMock'){b.disabled=true;try{await bluetooth.connect(b.id==='bleMock')}finally{b.disabled=false}}
   if(b.id==='bleMockTouch')await bluetooth.mockTouch();
   if(b.id==='bleDisconnect')await bluetooth.disconnect();
   if(b.id==='remoteLogout'){await api('/api/logout',{});location.reload()}
   if(b.id==='installApp'&&prompt){await prompt.prompt();prompt=null;b.hidden=true}
  }catch(e){toast(e.message)}
 });
 $('relayForm').addEventListener('submit',async e=>{e.preventDefault();const value=$('relayKey').value;$('relayKey').value='';try{await api('/api/relay',{url:$('relayUrl').value,hostKey:value});await refresh();toast('正在连接，请稍后刷新连接状态')}catch(error){toast(error.message)}});
 $('pairForm').addEventListener('submit',async e=>{e.preventDefault();$('pairSubmit').disabled=true;try{await pair($('pairInput').value);onPaired()}catch(error){$('pairError').textContent=error.message}finally{$('pairSubmit').disabled=false}});
 window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();prompt=e;$('installApp').hidden=false});
 if('serviceWorker'in navigator&&window.isSecureContext)void navigator.serviceWorker.register('/sw.js').catch(()=>{});
 if(window.vibeDesktop){document.body.classList.add('native-mini');$('desktopActions').hidden=false}
 return {initialPair:async()=>{const invite=new URLSearchParams(location.hash.slice(1)).get('invite');if(!invite)return;history.replaceState(null,'',location.pathname+location.search);try{await pair(invite)}catch(error){$('pairDialog').showModal();$('pairError').textContent=error.message}}};
}
