import sharp from 'sharp';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { buildAvifCompanions, validateAvifCompanions, inspectRuntimeImageBudget } from '@danilah/mini-games-kit/assets';

const output='public/art';await mkdir(output,{recursive:true});
const assets=[];
async function encode(id,source,width,height,cell,category,loadClass) {
 const metadata=await sharp(source).metadata();let pipeline=sharp(source);
 if(cell){const cw=Math.floor(metadata.width/cell.columns),ch=Math.floor(metadata.height/cell.rows);pipeline=pipeline.extract({left:cell.x*cw,top:cell.y*ch,width:cw,height:ch});}
 const webp=`${output}/${id}.webp`;
 await pipeline.resize(width,height,{fit:'cover',withoutEnlargement:false}).webp({quality:category==='character'?82:76,alphaQuality:100,effort:5}).toFile(webp);
 const encoded=await sharp(webp).metadata();
 assets.push({id,source,sourceWidth:metadata.width,sourceHeight:metadata.height,sourceSha256:createHash('sha256').update(await readFile(source)).digest('hex'),width:encoded.width,height:encoded.height,alpha:encoded.hasAlpha,category,loadClass,webp:`art/${id}.webp`,avif:`art/${id}.avif`,logicalFrame:'untrimmed; consistent across states',sourceCell:cell??null});
}
await encode('map','assets-src/map.png',1509,780,null,'background','startup');
for(const [i,id] of ['barry-due','barry-paid'].entries()) await encode(id,'assets-src/barry-states.png',630,645,{columns:2,rows:1,x:i,y:0},'character','startup');
for(const [i,id] of ['dishes','trash','courier','casino'].entries()) await encode(id,'assets-src/scene-atlas.png',836,470,{columns:2,rows:2,x:i%2,y:Math.floor(i/2)},'background','scene');
for(const [i,id] of ['plate','bag','crate','courier-icon'].entries()) await encode(id,'assets-src/interactables.png',384,384,{columns:2,rows:2,x:i%2,y:Math.floor(i/2)},'interactable','scene');
const pairs=assets.map(asset=>({id:asset.id,input:`public/${asset.webp}`,output:`public/${asset.avif}`,category:asset.category}));
await buildAvifCompanions(pairs,{quality:asset=>asset.category==='character'?65:58,effort:5,concurrency:2});
const validation=await validateAvifCompanions(pairs);
if(validation.errors.length)throw new Error(validation.errors.join('\n'));
const budget=await inspectRuntimeImageBudget(assets.map(asset=>({id:asset.id,file:`public/${asset.webp}`,category:asset.category})));
await writeFile(`${output}/manifest.json`,JSON.stringify({version:1,generation:{tool:'OpenAI image generation',date:'2026-10-01',style:'original hand-painted dirty cartoon; generated, not a manually painted commission'},assets,budget},null,2)+'\n');
await mkdir('release/media',{recursive:true});
const keyartMetadata=await sharp('assets-src/keyart.png').metadata();
await sharp('assets-src/keyart.png').webp({quality:90}).toFile('release/media/keyart.webp');
await sharp('assets-src/keyart.png').resize(320).webp({quality:85}).toFile('release/media/keyart-thumbnail.webp');
await writeFile('release/media/keyart-provenance.json',JSON.stringify({source:'assets-src/keyart.png',width:keyartMetadata.width,height:keyartMetadata.height,sourceSha256:createHash('sha256').update(await readFile('assets-src/keyart.png')).digest('hex'),generated:true,manuallyPainted:false,minimum2560MasterSatisfied:keyartMetadata.width>=2560&&keyartMetadata.height>=1440},null,2)+'\n');
console.log(JSON.stringify({assets:assets.length,budget,avifValidation:validation.errors,keyArtNative:{width:keyartMetadata.width,height:keyartMetadata.height}},null,2));
