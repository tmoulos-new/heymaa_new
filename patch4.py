f='C:/heymaa/frontend/src/App.tsx'
c=open(f,encoding='utf-8').read()
cam=chr(0x1f4f7)
old='                  <div style={{flex:1}}><div style={{fontSize:12.5,color:"#2B2420",lineHeight:1.45,fontWeight:500}}>{m.text!=="'+cam+'"?m.text:""}</div><div style={{fontSize:10,color:"#C8BFB8",marginTop:2}}>{m.date}</div></div>'
new='                  <div style={{flex:1}}>{editingMemIdx===origIdx?(<div style={{display:"flex",gap:5,marginBottom:4}}><input value={memEditVal} onChange={e=>setMemEditVal(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"){setMemories(memories.map((x,j)=>j===origIdx?{{...x,text:memEditVal.trim()||x.text}}:x));setEditingMemIdx(null);}if(e.key==="Escape")setEditingMemIdx(null);}} autoFocus style={{flex:1,padding:"5px 8px",border:"1.5px solid #7C5CBF",borderRadius:8,fontSize:12,color:"#2B2420",outline:"none"}}/><button onClick={{()=>{{setMemories(memories.map((x,j)=>j===origIdx?{{...x,text:memEditVal.trim()||x.text}}:x));setEditingMemIdx(null);}}}} style={{padding:"5px 10px",background:"#7C5CBF",color:"#fff",border:"none",borderRadius:8,fontSize:12,fontWeight:600,cursor:"pointer"}}>✓</button></div>):<div style={{fontSize:12.5,color:"#2B2420",lineHeight:1.45,fontWeight:500}}>{m.text!=="'+cam+'"?m.text:""}</div>}<div style={{fontSize:10,color:"#C8BFB8",marginTop:2}}>{m.date}</div></div>'
if old in c:
    c=c.replace(old,new,1)
    open(f,'w',encoding='utf-8').write(c)
    print('OK')
else:
    print('NOT FOUND')
