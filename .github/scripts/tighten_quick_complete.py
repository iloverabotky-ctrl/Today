from pathlib import Path

path = Path('src/notebook-v5-full.css')
text = path.read_text(encoding='utf-8')
old = r'''/* Notebook quick complete */
.nb5-quick-complete{
  display:grid;
  place-items:center;
  flex:0 0 18px;
  width:18px;
  height:18px;
  box-sizing:border-box;
  padding:0;
  border:1px solid #45505a;
  border-radius:50%;
  background:#111519;
  color:transparent;
  opacity:.72;
  cursor:pointer;
  font-size:10px;
  font-weight:760;
  line-height:1;
  transition:border-color .12s,background .12s,color .12s,opacity .12s,box-shadow .12s,transform .08s;
}
.nb5-quick-complete span{transform:translateY(-.2px)}
.nb5-row:hover .nb5-quick-complete,
.nb5-row.selected .nb5-quick-complete{border-color:#65727c;opacity:1}
.nb5-quick-complete:hover{
  border-color:#70c98d!important;
  background:rgba(77,151,99,.12)!important;
  color:#91e0aa!important;
  box-shadow:0 0 0 3px rgba(82,164,108,.055);
}
.nb5-quick-complete:active{transform:scale(.91)}
.nb5-row.completed .nb5-quick-complete{
  border-color:#5c9e70;
  background:rgba(77,151,99,.16);
  color:#8ed9a5;
}
.nb5-row.completed .nb5-title{text-decoration:line-through;text-decoration-color:#65706a;text-decoration-thickness:1px}
@media(max-width:760px){
  .nb5-quick-complete{flex-basis:20px;width:20px;height:20px;opacity:.9}
}'''
new = r'''/* Notebook quick complete — intentionally quiet */
.nb5-quick-complete{
  position:relative;
  display:grid;
  place-items:center;
  flex:0 0 18px;
  width:18px;
  height:18px;
  box-sizing:border-box;
  padding:0;
  border:0;
  background:transparent;
  color:transparent;
  opacity:.62;
  cursor:pointer;
  line-height:1;
  transition:opacity .12s,transform .08s;
}
.nb5-quick-complete::before{
  content:'';
  width:11px;
  height:11px;
  box-sizing:border-box;
  border:1px solid #465059;
  border-radius:50%;
  background:transparent;
  transition:border-color .12s,background .12s;
}
.nb5-quick-complete span{
  position:absolute;
  inset:0;
  display:grid;
  place-items:center;
  color:transparent;
  font-size:7px;
  font-weight:760;
  transform:translateY(-.1px);
  transition:color .12s;
}
.nb5-row:hover .nb5-quick-complete,
.nb5-row.selected .nb5-quick-complete{opacity:.86}
.nb5-quick-complete:hover{opacity:1}
.nb5-quick-complete:hover::before{
  border-color:#6fa07d;
  background:rgba(77,151,99,.055);
}
.nb5-quick-complete:hover span{color:#83ca99}
.nb5-quick-complete:active{transform:scale(.9)}
.nb5-row.completed .nb5-quick-complete{opacity:.82}
.nb5-row.completed .nb5-quick-complete::before{
  border-color:#5f8869;
  background:rgba(77,151,99,.09);
}
.nb5-row.completed .nb5-quick-complete span{color:#7fbd91}
.nb5-row.completed .nb5-title{text-decoration:line-through;text-decoration-color:#65706a;text-decoration-thickness:1px}
@media(max-width:760px){
  .nb5-quick-complete{flex-basis:20px;width:20px;height:20px;opacity:.76}
  .nb5-quick-complete::before{width:12px;height:12px}
}'''
if old not in text:
    raise SystemExit('Expected quick-complete block not found')
path.write_text(text.replace(old, new, 1), encoding='utf-8')
print('Quick complete control tightened')
