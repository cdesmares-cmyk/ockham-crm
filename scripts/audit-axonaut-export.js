const fs=require('fs');
let t=fs.readFileSync(process.argv[2],'utf8').replace(/^﻿/,'');
const rows=[];let r=[],f='',q=false;
for(let i=0;i<t.length;i++){const c=t[i];
 if(q){if(c=='"'){if(t[i+1]=='"'){f+='"';i++}else q=false}else f+=c}
 else if(c=='"')q=true; else if(c==';'){r.push(f);f=''} else if(c=='\n'){r.push(f.replace(/\r$/,''));rows.push(r);r=[];f=''} else f+=c}
if(f||r.length){r.push(f);rows.push(r)}
const H=rows.shift();const D=rows.filter(x=>x.length>1).map(x=>{const o={};H.forEach((h,i)=>{if(!(h in o))o[h]=(x[i]||'').trim()});return o});
console.log('cols',H.length,'rows',D.length,'bad width',rows.filter(x=>x.length!=H.length&&x.length>1).length);
const cnt=(k,n=15)=>{const m={};D.forEach(d=>m[d[k]||'(vide)']=(m[d[k]||'(vide)']||0)+1);console.log('\n##',k);Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,n).forEach(e=>console.log(' ',e[1],e[0]))};
const ids=new Set(D.map(d=>d['Id de la société']));console.log('unique company ids',ids.size);
const luhn=s=>{let sum=0;for(let i=0;i<14;i++){let n=+s[13-i];if(i%2){n*=2;if(n>9)n-=9}sum+=n}return sum%10==0};
let sv={vide:0,format:0,bidon:0,luhnKO:0,ok:0};const sirets={},sirens={};
D.forEach(d=>{const s=d.Siret.replace(/\s/g,'');if(!s)sv.vide++;else if(!/^\d{14}$/.test(s))sv.format++;else if(/^(\d)\1+$/.test(s))sv.bidon++;else if(!luhn(s)&&!s.startsWith('356000000'))sv.luhnKO++;else{sv.ok++;sirets[s]=(sirets[s]||0)+1;sirens[s.slice(0,9)]=(sirens[s.slice(0,9)]||0)+1}});
console.log('\n## SIRET',sv,'distinct siret',Object.keys(sirets).length,'siret partagés (>1 fiche)',Object.values(sirets).filter(v=>v>1).length,'distinct siren',Object.keys(sirens).length,'siren avec >1 fiche',Object.values(sirens).filter(v=>v>1).length);
const top=Object.entries(sirens).sort((a,b)=>b[1]-a[1]).slice(0,10);top.forEach(([s,n])=>console.log(' ',n,s,D.find(d=>d.Siret.startsWith(s)).Société));
console.log('\nFacturé à :',D.filter(d=>/^factur/i.test(d.Société)).length);
['Commercial responsable','Statut Client','Statut Prospect','Actif / Inactif','Mode de collecte','Zone','Secteur client final','Catégorie entreprise','Type de contrat','Catégorisation','Origine du contact','Public/Privé','Catégories','Mode envoi facture','Sous-traitance','Plateforme','Client soumis à BDC'].forEach(k=>cnt(k,20));
const cp={};D.forEach(d=>{const k=(d['Code postal']||'').slice(0,2)||'??';cp[k]=(cp[k]||0)+1});console.log('\n## dept',Object.entries(cp).sort((a,b)=>b[1]-a[1]).slice(0,12));
const num=s=>parseFloat((s||'0').replace(/\s/g,'').replace(',','.'))||0;
let tot=0,ty=0,withCA=0;D.forEach(d=>{tot+=num(d.turnover);ty+=num(d.turnoverThisYear);if(num(d.turnover)>0)withCA++});
console.log('\nCA total',tot.toFixed(0),'CA année',ty.toFixed(0),'fiches avec CA',withCA);
const bc={};D.forEach(d=>{const k=d['Commercial responsable']||'(vide)';bc[k]=bc[k]||{n:0,ca:0,cay:0};bc[k].n++;bc[k].ca+=num(d.turnover);bc[k].cay+=num(d.turnoverThisYear)});
console.log('\n## CA par commercial');Object.entries(bc).sort((a,b)=>b[1].cay-a[1].cay).forEach(([k,v])=>console.log(' ',k,v.n,Math.round(v.ca),Math.round(v.cay)));
const emails=D.filter(d=>d['Email du contact']&&!/example\.com/.test(d['Email du contact'])).length;console.log('\nemails exploitables',emails,'placeholder example.com',D.filter(d=>/example\.com/.test(d['Email du contact'])).length);
console.log('lastInvoice years');cnt('lastInvoiceDate',0);const yr={};D.forEach(d=>{const y=(d.lastInvoiceDate||'').slice(6)||'(jamais)';yr[y]=(yr[y]||0)+1});console.log(yr);
console.log('firstInvoice years');const fy={};D.forEach(d=>{const y=(d.firstInvoiceDate||'').slice(6)||'(jamais)';fy[y]=(fy[y]||0)+1});console.log(fy);
// columns fill rate
console.log('\n## taux de remplissage');H.forEach((h,i)=>{const n=D.filter(d=>d[h]&&d[h]!='-').length;console.log(' ',Math.round(100*n/D.length)+'%',h)});
