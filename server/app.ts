import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import path from 'node:path';
import { query, transaction } from './db';
import { loadUser, requireUser, roles, setSession, clearSession, hash } from './auth';
import { restaurantSchema, menuSchema, reviewSchema, replySchema, registerSchema, loginSchema, moderationSchema, filtersSchema } from './validation';

export const app = express();
app.disable('x-powered-by');
app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'https:', 'data:'], 'upgrade-insecure-requests': process.env.NODE_ENV==='production'?[]:null } } }));
app.use(express.json({limit:'32kb'}), cookieParser());
app.use('/api',rateLimit({windowMs:60000,limit:300,standardHeaders:'draft-8',legacyHeaders:false}));
app.use('/api',(req,res,next)=>{
  if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
    if(req.get('X-Requested-With')!=='LankaTable') return res.status(403).json({error:'Missing request verification header.'});
    if(req.get('Origin') && req.get('Origin')!==process.env.APP_ORIGIN) return res.status(403).json({error:'Request origin is not allowed.'});
  }
  next();
},loadUser);
const authLimit=rateLimit({windowMs:15*60000,limit:30,standardHeaders:'draft-8',legacyHeaders:false});
const id = (value: unknown) => z.coerce.number().int().positive().parse(value);

app.get('/api/health',async(_req,res)=>{ await query('SELECT 1'); res.json({status:'ok',database:'postgresql'}); });
app.get('/api/config',(_req,res)=>res.json({name:process.env.APP_NAME||'Lanka Table'}));
app.get('/api/auth/me',(req,res)=>res.json({user:req.user||null}));
app.post('/api/auth/register',authLimit,async(req,res)=>{
  const v=registerSchema.parse(req.body);
  const passwordHash=await bcrypt.hash(v.password,12);
  const user=(await query("INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name,email,role",[v.name,v.email,passwordHash])).rows[0];
  await setSession(res,user.id); res.status(201).json({user});
});
app.post('/api/auth/login',authLimit,async(req,res)=>{
  const v=loginSchema.parse(req.body);
  const user=(await query('SELECT * FROM users WHERE email=$1',[v.email])).rows[0];
  // Always perform a password comparison to reduce account enumeration by timing.
  const valid=await bcrypt.compare(v.password,user?.password_hash||'$2b$12$C6UzMDM.H6dfI/f/IKcEe.1yVNoAM2/Nh.WuEbqePOxfDnGOYz7iK');
  if(!user||!valid) return res.status(401).json({error:'Email or password is incorrect.'});
  if(req.cookies.session) await query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.cookies.session)]);
  await setSession(res,user.id); const {password_hash,...safe}=user; res.json({user:safe});
});
app.post('/api/auth/logout',async(req,res)=>{ if(req.cookies.session) await query('DELETE FROM sessions WHERE token_hash=$1',[hash(req.cookies.session)]); clearSession(res); res.json({ok:true}); });
app.get('/api/categories',async(_req,res)=>res.json((await query('SELECT * FROM categories ORDER BY id')).rows));

app.get('/api/explore',async(req,res)=>{
  const f=filtersSchema.parse(req.query); const params:unknown[]=[];
  const bind=(v:unknown)=>{params.push(v);return `$${params.length}`;};
  const restaurantWhere:string[]=[]; const dishWhere:string[]=[];
  if(f.city) {const p=bind(f.city); restaurantWhere.push(`r.city=${p}`);dishWhere.push(`m.city=${p}`);}
  if(f.band) {const p=bind(f.band);restaurantWhere.push(`r.price_band=${p}`);dishWhere.push(`rs.price_band=${p}`);}
  const match:string[]=[];
  if(f.category) match.push(`m.category_slug=${bind(f.category)}`);
  for(const key of ['vegetarian','vegan','halal'] as const) if(f[key]) match.push(`m.${key}=true`);
  if(f.spice!==undefined) match.push(`m.spice=${bind(Number(f.spice))}`);
  if(f.q) {
    const p=bind('%'+f.q.replace(/[\\%_]/g,'\\$&')+'%');
    const textMatch=`(m.name ILIKE ${p} OR m.name_si ILIKE ${p} OR m.name_ta ILIKE ${p} OR m.restaurant_name ILIKE ${p})`;
    match.push(textMatch);
  }
  if(match.length) {
    restaurantWhere.push(`EXISTS(SELECT 1 FROM menu_stats m WHERE m.restaurant_id=r.id AND ${match.join(' AND ')})`);
    dishWhere.push(...match);
  } else if(f.q) restaurantWhere.push('true');
  const rOrder={recommended:'r.rank_score DESC,r.review_count DESC',rating:'r.rating DESC NULLS LAST,r.review_count DESC','price-low':'r.avg_price ASC NULLS LAST','price-high':'r.avg_price DESC NULLS LAST',name:'r.name ASC'}[f.sort];
  const mOrder={recommended:'m.rank_score DESC,m.review_count DESC',rating:'m.rating DESC NULLS LAST,m.review_count DESC','price-low':'m.price ASC','price-high':'m.price DESC',name:'m.name ASC'}[f.sort];
  const [restaurants,dishes]=await Promise.all([
    query(`SELECT r.*,ARRAY(SELECT DISTINCT category FROM menu_stats WHERE restaurant_id=r.id) AS categories FROM restaurant_stats r ${restaurantWhere.length?'WHERE '+restaurantWhere.join(' AND '):''} ORDER BY ${rOrder},r.id`,params),
    query(`SELECT m.* FROM menu_stats m JOIN restaurant_stats rs ON rs.id=m.restaurant_id ${dishWhere.length?'WHERE '+dishWhere.join(' AND '):''} ORDER BY ${mOrder},m.id`,params)
  ]);
  res.json({restaurants:restaurants.rows,dishes:dishes.rows});
});
app.get('/api/restaurants/:id',async(req,res)=>{
  const restaurantId=id(req.params.id);
  const restaurant=(await query('SELECT * FROM restaurant_stats WHERE id=$1',[restaurantId])).rows[0];
  if(!restaurant) return res.status(404).json({error:'Restaurant not found.'});
  const [menu,reviews,breakdown]=await Promise.all([
    query('SELECT * FROM menu_stats WHERE restaurant_id=$1 ORDER BY category_id,id',[restaurantId]),
    query(`SELECT p.id,p.kind,p.body,p.food,p.service,p.value,p.ambience,p.parent_id,p.menu_item_id,p.created_at,u.name AS author,m.name AS dish_name
      FROM postings p JOIN users u ON u.id=p.author_id LEFT JOIN menu_items m ON m.id=p.menu_item_id
      WHERE p.restaurant_id=$1 AND p.status='approved' AND (p.parent_id IS NULL OR EXISTS(SELECT 1 FROM postings parent WHERE parent.id=p.parent_id AND parent.status='approved')) ORDER BY p.created_at DESC,p.id DESC`,[restaurantId]),
    query("SELECT AVG(food) AS food,AVG(service) AS service,AVG(value) AS value,AVG(ambience) AS ambience FROM postings WHERE restaurant_id=$1 AND kind='review' AND status='approved'",[restaurantId])
  ]);
  res.json({restaurant,menu:menu.rows,reviews:reviews.rows,breakdown:breakdown.rows[0]});
});
app.post('/api/reviews',requireUser,async(req,res)=>{
  const v=reviewSchema.parse(req.body);
  if(!(await query('SELECT 1 FROM restaurants WHERE id=$1',[v.restaurant_id])).rowCount) return res.status(404).json({error:'Restaurant not found.'});
  if(v.menu_item_id && !(await query('SELECT 1 FROM menu_items WHERE id=$1 AND restaurant_id=$2',[v.menu_item_id,v.restaurant_id])).rowCount) return res.status(400).json({error:'Select a dish from this restaurant.'});
  const own=(await query('SELECT owner_id FROM restaurants WHERE id=$1',[v.restaurant_id])).rows[0];
  if(own.owner_id===req.user!.id) return res.status(403).json({error:'You cannot review your own restaurant.'});
  const result=await query("INSERT INTO postings(author_id,restaurant_id,menu_item_id,kind,body,food,service,value,ambience) VALUES($1,$2,$3,'review',$4,$5,$6,$7,$8) RETURNING id,status",[req.user!.id,v.restaurant_id,v.menu_item_id,v.body,v.food,v.service,v.value,v.ambience]);
  res.status(201).json(result.rows[0]);
});
app.post('/api/reviews/:id/replies',requireUser,async(req,res)=>{
  const v=replySchema.parse(req.body);const parentId=id(req.params.id);
  const parent=(await query("SELECT p.*,r.owner_id FROM postings p JOIN restaurants r ON r.id=p.restaurant_id WHERE p.id=$1 AND p.kind='review' AND p.status='approved'",[parentId])).rows[0];
  if(!parent) return res.status(404).json({error:'Published review not found.'});
  if(v.kind==='response' && req.user!.role!=='admin' && parent.owner_id!==req.user!.id) return res.status(403).json({error:'Only the restaurant representative or portal administrator can post a company response.'});
  res.status(201).json((await query('INSERT INTO postings(author_id,restaurant_id,parent_id,kind,body) VALUES($1,$2,$3,$4,$5) RETURNING id,status',[req.user!.id,parent.restaurant_id,parentId,v.kind,v.body])).rows[0]);
});
app.get('/api/my-postings',requireUser,async(req,res)=>res.json((await query('SELECT p.*,r.name AS restaurant_name FROM postings p JOIN restaurants r ON r.id=p.restaurant_id WHERE author_id=$1 ORDER BY created_at DESC',[req.user!.id])).rows));

app.get('/api/admin/data',roles('admin','moderator'),async(req,res)=>{
  const [restaurants,menu,postings,owners]=await Promise.all([
    query('SELECT * FROM restaurant_stats ORDER BY id'), query('SELECT * FROM menu_stats ORDER BY restaurant_id,id'),
    query('SELECT p.*,u.name AS author,r.name AS restaurant_name,parent.body AS parent_body FROM postings p JOIN users u ON u.id=p.author_id JOIN restaurants r ON r.id=p.restaurant_id LEFT JOIN postings parent ON parent.id=p.parent_id ORDER BY p.created_at DESC,p.id DESC'),
    req.user!.role==='admin'?query("SELECT id,name FROM users WHERE role='owner' ORDER BY name"):Promise.resolve({rows:[]})
  ]);
  res.json({restaurants:restaurants.rows,menu:menu.rows,postings:postings.rows,owners:owners.rows});
});
app.post('/api/admin/restaurants',roles('admin'),async(req,res)=>{
  const v=restaurantSchema.parse(req.body);
  if(v.owner_id && !(await query("SELECT 1 FROM users WHERE id=$1 AND role='owner'",[v.owner_id])).rowCount) return res.status(400).json({error:'Choose a restaurant owner.'});
  const result=await transaction(async c=>{
    const r=(await c.query('INSERT INTO restaurants(name,city,address,description,image_url,owner_id) VALUES($1,$2,$3,$4,$5,$6) RETURNING *',[v.name,v.city,v.address,v.description,v.image_url,v.owner_id||null])).rows[0];
    await c.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES($1,'create','restaurant',$2)",[req.user!.id,r.id]);return r;
  });res.status(201).json(result);
});
app.put('/api/admin/restaurants/:id',roles('admin'),async(req,res)=>{
  const v=restaurantSchema.parse(req.body); const entityId=id(req.params.id);
  if(v.owner_id && !(await query("SELECT 1 FROM users WHERE id=$1 AND role='owner'",[v.owner_id])).rowCount) return res.status(400).json({error:'Choose a restaurant owner.'});
  const r=await transaction(async c=>{
    const r=(await c.query('UPDATE restaurants SET name=$1,city=$2,address=$3,description=$4,image_url=$5,owner_id=$6 WHERE id=$7 RETURNING *',[v.name,v.city,v.address,v.description,v.image_url,v.owner_id||null,entityId])).rows[0];
    if(r) await c.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id) VALUES($1,'update','restaurant',$2)",[req.user!.id,entityId]); return r;
  });if(!r) return res.status(404).json({error:'Restaurant not found.'});res.json(r);
});
app.post('/api/admin/menu',roles('admin'),async(req,res)=>{
  const v=menuSchema.parse(req.body);
  const keys=Object.keys(v);const values=Object.values(v);
  const r=await transaction(async c=>{
    const r=(await c.query(`INSERT INTO menu_items(${keys.join(',')}) VALUES(${values.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,values)).rows[0];
    await c.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,detail) VALUES($1,'create','menu_item',$2,$3)",[req.user!.id,r.id,JSON.stringify({price:v.price})]);return r;
  });res.status(201).json(r);
});
app.put('/api/admin/menu/:id',roles('admin'),async(req,res)=>{
  const v=menuSchema.parse(req.body);const entityId=id(req.params.id);const keys=Object.keys(v);const values=Object.values(v);
  const r=await transaction(async c=>{
    const before=(await c.query('SELECT * FROM menu_items WHERE id=$1 FOR UPDATE',[entityId])).rows[0];
    if(!before)return null;
    if(before.restaurant_id!==v.restaurant_id) throw Object.assign(new Error('A dish cannot be moved to another restaurant.'),{status:400});
    const r=(await c.query(`UPDATE menu_items SET ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} WHERE id=$${values.length+1} RETURNING *`,[...values,entityId])).rows[0];
    await c.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,detail) VALUES($1,'update','menu_item',$2,$3)",[req.user!.id,entityId,JSON.stringify({old_price:before.price,new_price:v.price})]);return r;
  });if(!r) return res.status(404).json({error:'Dish not found.'});res.json(r);
});
app.patch('/api/admin/postings/:id',roles('admin','moderator'),async(req,res)=>{
  const v=moderationSchema.parse(req.body);const entityId=id(req.params.id);
  const result=await transaction(async c=>{
    const p=(await c.query('SELECT * FROM postings WHERE id=$1 FOR UPDATE',[entityId])).rows[0];
    if(!p) throw Object.assign(new Error('Posting not found.'),{status:404});
    if(p.author_id===req.user!.id) throw Object.assign(new Error('Another moderator must review your own posting.'),{status:403});
    if(p.parent_id && v.status==='approved' && !(await c.query("SELECT 1 FROM postings WHERE id=$1 AND status='approved'",[p.parent_id])).rowCount) throw Object.assign(new Error('Approve the parent review first.'),{status:409});
    const updated=(await c.query('UPDATE postings SET status=$1,moderation_reason=$2,moderated_by=$3,moderated_at=now() WHERE id=$4 RETURNING *',[v.status,v.reason,req.user!.id,entityId])).rows[0];
    await c.query("INSERT INTO audit_log(actor_id,action,entity_type,entity_id,detail) VALUES($1,'moderate','posting',$2,$3)",[req.user!.id,entityId,JSON.stringify({from:p.status,to:v.status,reason:v.reason})]);return updated;
  });res.json(result);
});
app.use('/api',(_req,res)=>res.status(404).json({error:'API route not found.'}));
app.use(express.static(path.resolve('dist')));
app.get('/{*path}',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
app.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>{
  if(error instanceof z.ZodError) return res.status(400).json({error:error.issues.map(i=>`${i.path.join('.')||'Input'}: ${i.message}`).join('; ')});
  if(error.code==='23505') return res.status(409).json({error:'An entry with those details already exists.'});
  if(error.code==='23503'||error.code==='23514') return res.status(400).json({error:'Check the related entry and required field values.'});
  if(error.status && error.status<500) return res.status(error.status).json({error:error.message});
  console.error(error);res.status(500).json({error:'Something went wrong. Please try again.'});
});
